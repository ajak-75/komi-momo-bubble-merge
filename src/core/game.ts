import type { BubbleDef, GameBubble, GameEvent, GameState } from './types';
import type { Rng } from './rng';
import { createRng } from './rng';
import { PhysicsWorld } from './physics';
import { mergeRule } from './merge';
import {
  COMBO_WINDOW,
  DANGER_SECONDS,
  DANGER_Y,
  DROP_COOLDOWN,
  DROP_SPEED,
  DROP_Y,
  GRAVITY,
  KOMI_LINE,
  MAX_COMBO,
  MOMO_LINE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  defById,
} from './config';

export interface GameOptions {
  seed?: number;
  worldWidth?: number;
  worldHeight?: number;
  discovered?: Iterable<string>;
  best?: number;
  /** Share of level-2 bubbles in the spawn pool (0..1). */
  level2Chance?: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * Headless game simulation: physics + merge rules + scoring + collection unlocks.
 * It never touches the DOM, so the whole rule set is covered by automated tests.
 */
export class BubbleMergeGame {
  readonly world: PhysicsWorld<GameBubble>;
  state: GameState = 'idle';
  score = 0;
  best = 0;
  current: BubbleDef | null = null;
  next: BubbleDef | null = null;
  dropX = WORLD_WIDTH / 2;
  events: GameEvent[] = [];
  discovered = new Set<string>();
  combo = 0;
  comboTimer = 0;
  bestCombo = 0;
  dangerTimer = 0;
  time = 0;
  slowMo = 0;
  merges = 0;
  absorbed = 0;
  legendaries = 0;
  dropCooldown = 0;
  private rng: Rng;
  private level2Chance: number;

  constructor(opts: GameOptions = {}) {
    this.rng = createRng(opts.seed ?? 20261120);
    this.level2Chance = opts.level2Chance ?? 0.2;
    this.world = new PhysicsWorld<GameBubble>(opts.worldWidth ?? WORLD_WIDTH, opts.worldHeight ?? WORLD_HEIGHT, {
      gravity: GRAVITY,
    });
    this.best = opts.best ?? 0;
    if (opts.discovered) for (const id of opts.discovered) this.discovered.add(id);
    this.dropX = this.world.width / 2;
  }

  /* ------------------------------------------------------------------ run */

  start(): void {
    this.state = 'playing';
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.dangerTimer = 0;
    this.time = 0;
    this.slowMo = 0;
    this.merges = 0;
    this.absorbed = 0;
    this.legendaries = 0;
    this.dropCooldown = 0;
    this.world.clear();
    this.events.length = 0;
    this.current = this.rollBubble();
    this.next = this.rollBubble();
    this.dropX = this.world.width / 2;
  }

  pause(): void {
    if (this.state === 'playing') this.state = 'paused';
  }

  resume(): void {
    if (this.state === 'paused') this.state = 'playing';
  }

  toMenu(): void {
    this.state = 'idle';
    this.world.clear();
    this.current = null;
    this.next = null;
  }

  setWorldHeight(height: number): void {
    this.world.setSize(this.world.width, height);
    this.dropX = clamp(this.dropX, 0, this.world.width);
  }

  setBest(best: number): void {
    this.best = best;
  }

  /* --------------------------------------------------------------- input */

  setPointer(x: number): void {
    this.dropX = clamp(x, 0, this.world.width);
  }

  /** X where the held bubble would be released. */
  heldX(): number {
    const def = this.current;
    if (!def) return this.dropX;
    return clamp(this.dropX, def.radius + 2, this.world.width - def.radius - 2);
  }

  drop(): boolean {
    if (this.state !== 'playing' || !this.current || this.dropCooldown > 0) return false;
    const def = this.current;
    const x = this.heldX();
    const bubble = this.spawn(def, x, DROP_Y, 0, DROP_SPEED);
    this.events.push({ type: 'drop', def, x, y: bubble.y });
    this.current = this.next ?? this.rollBubble();
    this.next = this.rollBubble();
    this.dropCooldown = DROP_COOLDOWN;
    return true;
  }

  /* ------------------------------------------------------------ stepping */

  step(ms: number): void {
    if (this.state !== 'playing') return;
    const real = clamp(ms, 0, 64) / 1000;
    this.time += real;
    if (this.dropCooldown > 0) this.dropCooldown = Math.max(0, this.dropCooldown - real);

    let dt = real;
    if (this.slowMo > 0) {
      this.slowMo = Math.max(0, this.slowMo - real);
      dt = real * 0.28;
    }

    this.world.step(dt);
    this.resolveMerges();
    this.compact();
    this.updateCombo(real);
    this.updateDanger(real);
    this.updateTrophies();
  }

  private updateCombo(dt: number): void {
    if (this.combo <= 0) return;
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) {
      this.combo = 0;
      this.comboTimer = 0;
    }
  }

  private updateDanger(dt: number): void {
    let over = false;
    for (const b of this.world.bodies) {
      if (!b.alive) continue;
      if (this.time - b.bornAt < 1) continue;
      if (b.y - b.r < DANGER_Y) {
        over = true;
        break;
      }
    }
    if (over) this.dangerTimer += dt;
    else this.dangerTimer = Math.max(0, this.dangerTimer - dt * 1.6);

    if (this.dangerTimer >= DANGER_SECONDS) this.gameOver();
  }

  private updateTrophies(): void {
    if (this.score >= 2000) this.discover('komi-hanbok');
    if (this.legendaries > 0) this.discover('komi-gold');
  }

  gameOver(): void {
    if (this.state === 'over') return;
    this.state = 'over';
    const isBest = this.score > this.best;
    if (isBest) this.best = this.score;
    this.events.push({ type: 'gameover', score: this.score, best: isBest });
  }

  /* -------------------------------------------------------------- merges */

  private resolveMerges(): void {
    const bodies = this.world.bodies;
    const used = new Set<number>();
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      if (!a.alive || used.has(a.id)) continue;
      for (let j = i + 1; j < bodies.length; j++) {
        if (!a.alive) break;
        const b = bodies[j];
        if (!b.alive || used.has(b.id) || a.id === b.id) continue;
        if (this.time < a.mergeReadyAt || this.time < b.mergeReadyAt) continue;
        const rule = mergeRule(a.def, b.def);
        if (!rule) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        // Touching is enough: the solver separates overlaps before this pass,
        // so a strict "must overlap" test would never fire.
        const reach = (a.r + b.r) * 1.004;
        if (dx * dx + dy * dy > reach * reach) continue;
        used.add(a.id);
        used.add(b.id);
        this.applyMerge(a, b, rule);
        if (!a.alive) break;
      }
    }
  }

  private applyMerge(a: GameBubble, b: GameBubble, rule: ReturnType<typeof mergeRule>): void {
    if (!rule) return;
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const vx = (a.vx + b.vx) / 2;
    const vy = (a.vy + b.vy) / 2;

    this.combo = Math.min(MAX_COMBO, this.combo + 1);
    this.comboTimer = COMBO_WINDOW;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const multiplier = 1 + (this.combo - 1) * 0.2;

    if (rule.kind === 'evolve' && rule.into) {
      this.removeBody(a.id);
      this.removeBody(b.id);
      const created = this.spawn(rule.into, midX, midY, vx, vy);
      created.mergeReadyAt = this.time + 0.1;
      const points = Math.round(rule.into.score * multiplier);
      this.score += points;
      this.merges += 1;
      this.events.push({ type: 'merge', def: rule.into, x: midX, y: midY, combo: this.combo, points });
      if (this.combo >= 3) this.events.push({ type: 'combo', value: this.combo, x: midX, y: midY });
      return;
    }

    if (rule.kind === 'legend' && rule.into) {
      this.removeBody(a.id);
      this.removeBody(b.id);
      const created = this.spawn(rule.into, midX, midY, vx, vy);
      created.mergeReadyAt = this.time + 0.35;
      const points = Math.round(rule.into.score * multiplier);
      this.score += points;
      this.merges += 1;
      this.legendaries += 1;
      this.slowMo = 1.8;
      this.events.push({ type: 'legendary', def: rule.into, x: midX, y: midY, points });
      this.discover('komi-gold');
      return;
    }

    // absorb: one of the two survives, the touch only pays a bonus
    const keep = a.mass >= b.mass ? a : b;
    const gone = keep === a ? b : a;
    this.removeBody(gone.id);
    keep.mergeReadyAt = this.time + 0.3;
    keep.vx = vx * 0.5;
    keep.vy = vy * 0.5;
    const bonus = rule.bonus ?? 50;
    const points = Math.round(bonus * multiplier);
    this.score += points;
    this.absorbed += 1;
    this.events.push({ type: 'absorb', def: keep.def, x: midX, y: midY, points });
  }

  /* ------------------------------------------------------------- bubbles */

  /** Marks a bubble for removal; the array is compacted once per frame. */
  private removeBody(id: number): void {
    const body = this.world.bodies.find((b) => b.id === id);
    if (body) body.alive = false;
  }

  /** Drops every dead bubble from the physics list (never during a pair scan). */
  private compact(): void {
    const list = this.world.bodies;
    for (let i = list.length - 1; i >= 0; i--) if (!list[i].alive) list.splice(i, 1);
  }

  private spawn(def: BubbleDef, x: number, y: number, vx: number, vy: number, grace = 0.12): GameBubble {
    const body: GameBubble = {
      id: this.world.nextBodyId(),
      def,
      x: clamp(x, def.radius, this.world.width - def.radius),
      y,
      vx,
      vy,
      r: def.radius,
      mass: def.radius * def.radius,
      alive: true,
      bornAt: this.time,
      mergeReadyAt: this.time + grace,
    };
    this.world.add(body);
    this.discover(def.id);
    return body;
  }

  /** Test / debug hook: place a bubble that may merge immediately. */
  place(id: string, x: number, y: number, vy = 0): GameBubble {
    const def = this.defFor(id);
    return this.spawn(def, x, y, 0, vy, 0);
  }

  private defFor(id: string): BubbleDef {
    return defById(id);
  }

  private rollBubble(): BubbleDef {
    const useLevel2 = this.rng.next() < this.level2Chance;
    const line = this.rng.next() < 0.5 ? MOMO_LINE : KOMI_LINE;
    const def = useLevel2 ? line[1] : line[0];
    this.discover(def.id);
    return def;
  }

  private discover(id: string): void {
    if (this.discovered.has(id)) return;
    this.discovered.add(id);
    this.events.push({ type: 'discover', id });
  }

  /* ------------------------------------------------------------- helpers */

  drainEvents(): GameEvent[] {
    if (this.events.length === 0) return [];
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  dangerRatio(): number {
    return clamp(this.dangerTimer / DANGER_SECONDS, 0, 1);
  }

  liveBubbles(): GameBubble[] {
    return this.world.bodies.filter((b) => b.alive);
  }
}
