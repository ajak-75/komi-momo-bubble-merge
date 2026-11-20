/**
 * The board, the cannon and the rules of the bubble shooter.
 *
 * Everything here is plain data + pure helpers, so the whole game can be
 * driven from a test with no DOM and no canvas.
 */

import {
  clampAngle,
  pointAtDistance,
  traceShot,
  type BubbleCircle,
  type TraceResult,
} from './aim';
import {
  CLEAR_BONUS,
  DROP_POINTS,
  LAUNCH_ZONE,
  POP_BASE,
  POP_EXTRA,
  SHOT_SPEED,
  comboMultiplier,
  levelConfig,
  type LevelConfig,
} from './config';
import {
  BOARD_WIDTH,
  BUBBLE_RADIUS,
  cellKey,
  cellFromPoint,
  cellX,
  cellY,
  colsInRow,
  inBounds,
  neighbors,
} from './hex';
import { findCluster, findFloating, gridView } from './match';
import type { Rng } from './rng';
import type { Bubble, Cell, ColorId, FallingBubble, Phase } from './types';

export type GameEvent =
  | { type: 'shoot'; color: ColorId }
  | { type: 'wall' }
  | { type: 'pop'; cells: Cell[]; color: ColorId; points: number; combo: number; at: { x: number; y: number } }
  | { type: 'drop'; count: number; points: number; at: { x: number; y: number } }
  | { type: 'row' }
  | { type: 'miss' }
  | { type: 'clear'; level: number; bonus: number }
  | { type: 'over' }
  | { type: 'swap' };

export interface FlyingShot {
  color: ColorId;
  trace: TraceResult;
  travel: number;
  bouncesPlayed: number;
}

const GRAVITY = 2300;

export class BubbleShooter {
  readonly rng: Rng;
  height = 1560;
  topRow = 0;
  level = 1;
  score = 0;
  phase: Phase = 'ready';
  combo = 0;
  bestCombo = 0;
  current: ColorId = 'violet';
  next: ColorId = 'pink';
  angle = 0;
  shots = 0;
  shotsUntilRow = 9;
  cfg: LevelConfig = levelConfig(1);
  flying: FlyingShot | null = null;
  falling: FallingBubble[] = [];
  events: GameEvent[] = [];

  private grid = new Map<string, Bubble>();

  constructor(rng: Rng, height = 1560) {
    this.rng = rng;
    this.height = height;
    this.startLevel(1);
  }

  /* ------------------------------------------------------------- geometry */

  get ceilingY(): number {
    return 0;
  }

  get deadlineY(): number {
    return this.height - LAUNCH_ZONE;
  }

  get launcherX(): number {
    return BOARD_WIDTH / 2;
  }

  get launcherY(): number {
    return this.height - 96;
  }

  get nextX(): number {
    return BOARD_WIDTH - 124;
  }

  setHeight(height: number): void {
    this.height = Math.max(900, height);
  }

  /* ---------------------------------------------------------------- board */

  bubbles(): Bubble[] {
    return [...this.grid.values()];
  }

  bubbleAt(row: number, col: number): Bubble | undefined {
    return this.grid.get(cellKey(row, col));
  }

  get count(): number {
    return this.grid.size;
  }

  centerOf(row: number, col: number): { x: number; y: number } {
    return { x: cellX(row, col), y: cellY(row, this.topRow, this.ceilingY) };
  }

  /** Bubbles still hanging on the board, as circles for the aim tracer. */
  circles(): BubbleCircle[] {
    return this.bubbles().map((b) => ({ ...this.centerOf(b.row, b.col), row: b.row, col: b.col }));
  }

  /* --------------------------------------------------------------- levels */

  startLevel(level: number): void {
    this.level = Math.max(1, Math.floor(level));
    this.cfg = levelConfig(this.level);
    this.topRow = 0;
    this.grid.clear();
    this.falling = [];
    this.flying = null;
    this.combo = 0;
    this.shots = 0;
    this.angle = 0;
    this.generate(this.cfg);
    this.current = this.pickColor();
    this.next = this.pickColor();
    this.shotsUntilRow = this.cfg.dropEvery;
    this.phase = 'ready';
  }

  nextLevel(): void {
    this.startLevel(this.level + 1);
  }

  private generate(cfg: LevelConfig): void {
    const placed: Bubble[] = [];
    for (let row = 0; row < cfg.rows; row++) {
      for (let col = 0; col < colsInRow(row); col++) {
        let color = this.rng.pick(cfg.colors);
        for (let tries = 0; tries < 14; tries++) {
          const candidate = this.rng.pick(cfg.colors);
          placed.push({ row, col, color: candidate });
          const opensCluster = findCluster(gridView(placed), { row, col }).length >= 3;
          placed.pop();
          if (!opensCluster) {
            color = candidate;
            break;
          }
        }
        placed.push({ row, col, color });
      }
    }
    for (const b of placed) this.grid.set(cellKey(b.row, b.col), b);
  }

  /** Only colours still on the board are handed to the cannon. */
  private pickColor(): ColorId {
    const alive = new Set<ColorId>();
    for (const b of this.grid.values()) alive.add(b.color);
    if (alive.size === 0) return this.rng.pick(this.cfg.colors);
    return this.rng.pick([...alive]);
  }

  /** Loads a hand-made board (tests, and future hand-designed stages). */
  loadBoard(
    cells: Array<{ row: number; col: number; color: ColorId }>,
    opts: { topRow?: number; current?: ColorId; next?: ColorId; dropEvery?: number } = {},
  ): void {
    this.grid.clear();
    for (const c of cells) this.grid.set(cellKey(c.row, c.col), { ...c });
    this.topRow = opts.topRow ?? 0;
    this.current = opts.current ?? cells[0]?.color ?? 'violet';
    this.next = opts.next ?? this.current;
    this.shotsUntilRow = opts.dropEvery ?? this.cfg.dropEvery;
    this.phase = this.grid.size === 0 ? 'cleared' : 'ready';
    this.flying = null;
    this.falling = [];
    this.combo = 0;
    this.events = [];
  }

  /* ------------------------------------------------------------------ aim */

  setAngle(angle: number): void {
    this.angle = clampAngle(angle);
  }

  /** Traced path (and the cell it would land in) for the dotted guide. */
  aim(): { trace: TraceResult; cell: Cell | null } {
    const trace = traceShot({
      from: { x: this.launcherX, y: this.launcherY },
      angle: this.angle,
      ceilingY: this.ceilingY,
      bubbles: this.circles(),
    });
    return { trace, cell: this.landingCell(trace) };
  }

  /* ----------------------------------------------------------------- fire */

  fire(): void {
    if (this.phase !== 'ready') return;
    const { trace } = this.aim();
    const color = this.current;
    this.flying = { color, trace, travel: 0, bouncesPlayed: 0 };
    this.current = this.next;
    this.next = this.pickColor();
    this.shots += 1;
    this.phase = 'flying';
    this.events.push({ type: 'shoot', color });
  }

  swap(): void {
    if (this.phase !== 'ready') return;
    const tmp = this.current;
    this.current = this.next;
    this.next = tmp;
    this.events.push({ type: 'swap' });
  }

  /* --------------------------------------------------------------- update */

  update(dt: number): void {
    const step = Math.min(0.05, Math.max(0, dt));
    for (const f of this.falling) {
      f.vy += GRAVITY * step;
      f.x += f.vx * step;
      f.y += f.vy * step;
      f.rot += f.spin * step;
      f.life -= step;
    }
    this.falling = this.falling.filter((f) => f.life > 0 && f.y < this.height + 160);

    const shot = this.flying;
    if (!shot) return;
    shot.travel += SHOT_SPEED * step;
    while (shot.bouncesPlayed < shot.trace.bounceLengths.length && shot.travel >= shot.trace.bounceLengths[shot.bouncesPlayed]) {
      shot.bouncesPlayed += 1;
      this.events.push({ type: 'wall' });
    }
    if (shot.travel >= shot.trace.length) this.land(shot);
  }

  position(): { x: number; y: number } | null {
    if (!this.flying) return null;
    return pointAtDistance(this.flying.trace.points, this.flying.travel);
  }

  /** The nearest empty cell a shot at `trace` would settle into. */
  landingCell(trace: TraceResult): Cell | null {
    const free = (row: number, col: number) => inBounds(row, col) && !this.grid.has(cellKey(row, col));
    const point = trace.hit;
    const candidates: Cell[] = [];

    if (trace.hitBubble) {
      for (const [row, col] of neighbors(trace.hitBubble.row, trace.hitBubble.col)) {
        if (row >= this.topRow && free(row, col)) candidates.push({ row, col });
      }
    }
    if (trace.ceiling && trace.hitBubble === null) {
      const snapped = cellFromPoint(trace.hit.x, trace.hit.y, this.topRow, this.ceilingY);
      for (const col of [snapped.col, snapped.col - 1, snapped.col + 1]) {
        if (col >= 0 && col < colsInRow(this.topRow) && free(this.topRow, col)) {
          candidates.push({ row: this.topRow, col });
        }
      }
    }
    if (candidates.length === 0) return null;

    let best = candidates[0];
    let bestDist = Number.POSITIVE_INFINITY;
    for (const c of candidates) {
      if (c.row < this.topRow) continue;
      const center = this.centerOf(c.row, c.col);
      const d = Math.hypot(center.x - point.x, center.y - point.y);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return best;
  }

  private fallbackCell(trace: TraceResult): Cell | null {
    const point = trace.hit;
    let best: Cell | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let row = this.topRow; row <= this.topRow + 40; row++) {
      for (let col = 0; col < colsInRow(row); col++) {
        if (this.grid.has(cellKey(row, col))) continue;
        const center = this.centerOf(row, col);
        const d = Math.hypot(center.x - point.x, center.y - point.y);
        if (d < bestDist) {
          bestDist = d;
          best = { row, col };
        }
      }
    }
    return best;
  }

  private land(shot: FlyingShot): void {
    const cell = this.landingCell(shot.trace) ?? this.fallbackCell(shot.trace);
    this.flying = null;
    this.phase = 'ready';
    if (!cell || cell.row < this.topRow) {
      this.resolveShotEnd();
      return;
    }

    this.grid.set(cellKey(cell.row, cell.col), { row: cell.row, col: cell.col, color: shot.color });
    const cluster = findCluster(gridView(this.grid.values()), cell);

    if (cluster.length >= 3) {
      this.popCluster(cluster, shot.color);
    } else {
      this.combo = 0;
      this.events.push({ type: 'miss' });
    }

    this.resolveShotEnd();
  }

  private popCluster(cluster: Cell[], color: ColorId): void {
    const center = this.centerOf(cluster[0].row, cluster[0].col);
    for (const c of cluster) this.grid.delete(cellKey(c.row, c.col));
    this.combo += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const mult = comboMultiplier(this.combo);
    const points = Math.round((POP_BASE * cluster.length + POP_EXTRA * Math.max(0, cluster.length - 3)) * mult);
    this.score += points;
    this.events.push({ type: 'pop', cells: cluster, color, points, combo: this.combo, at: center });

    const floating = findFloating(gridView(this.grid.values()), this.topRow);
    if (floating.length > 0) {
      const first = this.centerOf(floating[0].row, floating[0].col);
      for (const c of floating) {
        const bubble = this.grid.get(cellKey(c.row, c.col));
        this.grid.delete(cellKey(c.row, c.col));
        if (!bubble) continue;
        const p = this.centerOf(c.row, c.col);
        this.falling.push({
          color: bubble.color,
          x: p.x,
          y: p.y,
          vx: (this.rng.next() - 0.5) * 150,
          vy: -120 - this.rng.next() * 90,
          rot: 0,
          spin: (this.rng.next() - 0.5) * 6,
          life: 2.4,
        });
      }
      const dropPoints = Math.round(DROP_POINTS * floating.length * mult);
      this.score += dropPoints;
      this.events.push({ type: 'drop', count: floating.length, points: dropPoints, at: first });
    }
  }

  private resolveShotEnd(): void {
    this.shotsUntilRow -= 1;
    if (this.grid.size === 0) {
      const bonus = CLEAR_BONUS * this.level;
      this.score += bonus;
      this.phase = 'cleared';
      this.events.push({ type: 'clear', level: this.level, bonus });
      return;
    }
    if (this.shotsUntilRow <= 0) this.dropRow();
    this.checkDeadline();
  }

  dropRow(): void {
    this.topRow -= 1;
    for (let col = 0; col < colsInRow(this.topRow); col++) {
      this.grid.set(cellKey(this.topRow, col), {
        row: this.topRow,
        col,
        color: this.pickColor(),
      });
    }
    this.shotsUntilRow = this.cfg.dropEvery;
    this.events.push({ type: 'row' });
  }

  /** True when any bubble hangs past the danger line. */
  overLine(): boolean {
    for (const b of this.grid.values()) {
      if (this.centerOf(b.row, b.col).y + BUBBLE_RADIUS > this.deadlineY) return true;
    }
    return false;
  }

  /** How close the lowest bubble is to the line, 0 (safe) .. 1 (touching). */
  pressure(): number {
    let lowest = -Infinity;
    for (const b of this.grid.values()) lowest = Math.max(lowest, this.centerOf(b.row, b.col).y);
    if (!Number.isFinite(lowest)) return 0;
    const line = this.deadlineY - BUBBLE_RADIUS;
    const start = line - 260;
    return Math.max(0, Math.min(1, (lowest - start) / (line - start)));
  }

  private checkDeadline(): void {
    if (this.grid.size === 0) return;
    if (this.overLine()) {
      this.phase = 'over';
      this.events.push({ type: 'over' });
    }
  }

  takeEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }
}
