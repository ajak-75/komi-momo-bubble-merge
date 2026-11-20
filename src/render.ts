import type { BubbleMergeGame } from './core/game';
import type { GameBubble } from './core/types';
import { DANGER_Y, WORLD_HEIGHT, WORLD_WIDTH } from './core/config';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: 'spark' | 'bubble';
}

interface Ring {
  x: number;
  y: number;
  r: number;
  maxR: number;
  life: number;
  maxLife: number;
  color: string;
  width: number;
}

interface Floater {
  x: number;
  y: number;
  text: string;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Ambient {
  x: number;
  y: number;
  r: number;
  speed: number;
  alpha: number;
  hue: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private images: Record<string, HTMLImageElement>;
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private floaters: Floater[] = [];
  private ambient: Ambient[] = [];
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private dpr = 1;
  private shake = 0;
  private t = 0;

  constructor(canvas: HTMLCanvasElement, images: Record<string, HTMLImageElement>) {
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('canvas 2d context unavailable');
    this.canvas = canvas;
    this.ctx = ctx;
    this.images = images;
    this.buildAmbient();
  }

  private buildAmbient(): void {
    this.ambient = [];
    // deterministic pseudo random so the scene does not reshuffle on resize
    let s = 1337;
    const rand = (): number => {
      s = (s * 1103515245 + 12345) % 2147483648;
      return s / 2147483648;
    };
    for (let i = 0; i < 26; i++) {
      this.ambient.push({
        x: rand() * WORLD_WIDTH,
        y: rand() * WORLD_HEIGHT,
        r: 8 + rand() * 46,
        speed: 6 + rand() * 18,
        alpha: 0.03 + rand() * 0.06,
        hue: 300 + rand() * 80,
      });
    }
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.scale = Math.min(w / WORLD_WIDTH, h / WORLD_HEIGHT);
    this.offsetX = (w - WORLD_WIDTH * this.scale) / 2;
    this.offsetY = (h - WORLD_HEIGHT * this.scale) / 2;
  }

  /** Converts a client-space point into world units. */
  toWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.offsetX) / this.scale,
      y: (clientY - rect.top - this.offsetY) / this.scale,
    };
  }

  get worldScale(): number {
    return this.scale;
  }

  burst(x: number, y: number, color: string, power = 1, count = 14): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (60 + Math.random() * 240) * power;
      const life = 0.4 + Math.random() * 0.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        life,
        maxLife: life,
        size: 2 + Math.random() * 5 * power,
        color,
        kind: Math.random() > 0.5 ? 'spark' : 'bubble',
      });
    }
  }

  ring(x: number, y: number, color: string, maxR: number, width = 6): void {
    this.rings.push({ x, y, r: 6, maxR, life: 0.55, maxLife: 0.55, color, width });
  }

  floater(x: number, y: number, text: string, color = '#ffe9a8', size = 30): void {
    this.floaters.push({ x, y, text, life: 1.1, maxLife: 1.1, color, size });
  }

  kick(power: number): void {
    this.shake = Math.max(this.shake, power);
  }

  /** Golden energy gathering into one point (played right before the fusion flash). */
  implode(x: number, y: number, color = '#ffe9a8', count = 30): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const dist = 70 + Math.random() * 150;
      const speed = 190 + Math.random() * 190;
      const life = 0.45 + Math.random() * 0.2;
      this.particles.push({
        x: x + Math.cos(a) * dist,
        y: y + Math.sin(a) * dist,
        vx: -Math.cos(a) * speed,
        vy: -Math.sin(a) * speed,
        life,
        maxLife: life,
        size: 2 + Math.random() * 3.5,
        color,
        kind: 'spark',
      });
    }
  }

  legendaryBurst(x: number, y: number): void {
    this.kick(16);
    for (let i = 0; i < 4; i++) {
      window.setTimeout(() => this.ring(x, y, '#ffd76a', 160 + i * 90, 10 - i * 2), i * 90);
    }
    this.burst(x, y, '#ffe9a8', 2.2, 40);
    this.burst(x, y, '#ff8bd0', 1.6, 24);
  }

  /** Draws one frame. `dtMs` is real elapsed time. */
  draw(game: BubbleMergeGame, dtMs: number): void {
    const ctx = this.ctx;
    const dt = clamp(dtMs, 0, 64) / 1000;
    this.t += dt;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const shakeX = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    const shakeY = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    this.shake = Math.max(0, this.shake - dt * 55);

    ctx.save();
    ctx.translate(this.offsetX * this.dpr + shakeX * this.dpr, this.offsetY * this.dpr + shakeY * this.dpr);
    ctx.scale(this.scale * this.dpr, this.scale * this.dpr);

    this.drawBackground(ctx);
    this.drawDangerLine(ctx, game);
    this.drawBodies(ctx, game);
    this.drawEffects(ctx, dt);
    if (game.slowMo > 0) this.drawSlowMotion(ctx, game);

    ctx.restore();
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    const grad = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
    grad.addColorStop(0, '#141634');
    grad.addColorStop(0.45, '#101226');
    grad.addColorStop(1, '#1b1030');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    const glow = ctx.createRadialGradient(WORLD_WIDTH / 2, WORLD_HEIGHT * 0.18, 40, WORLD_WIDTH / 2, WORLD_HEIGHT * 0.18, 620);
    glow.addColorStop(0, 'rgba(255, 196, 120, 0.16)');
    glow.addColorStop(1, 'rgba(255, 196, 120, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    for (const a of this.ambient) {
      const y = ((a.y - this.t * a.speed) % (WORLD_HEIGHT + 200) + WORLD_HEIGHT + 200) % (WORLD_HEIGHT + 200) - 100;
      ctx.beginPath();
      ctx.arc(a.x, y, a.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${a.hue}, 80%, 70%, ${a.alpha})`;
      ctx.fill();
    }

    // floor
    const floor = ctx.createLinearGradient(0, WORLD_HEIGHT - 90, 0, WORLD_HEIGHT);
    floor.addColorStop(0, 'rgba(255, 214, 150, 0)');
    floor.addColorStop(1, 'rgba(255, 214, 150, 0.16)');
    ctx.fillStyle = floor;
    ctx.fillRect(0, WORLD_HEIGHT - 90, WORLD_WIDTH, 90);
  }

  private drawDangerLine(ctx: CanvasRenderingContext2D, game: BubbleMergeGame): void {
    const danger = game.dangerRatio();
    ctx.save();
    ctx.setLineDash([14, 12]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = danger > 0 ? `rgba(255, 90, 110, ${0.35 + danger * 0.6})` : 'rgba(255, 235, 255, 0.18)';
    ctx.beginPath();
    ctx.moveTo(10, DANGER_Y);
    ctx.lineTo(WORLD_WIDTH - 10, DANGER_Y);
    ctx.stroke();
    ctx.restore();

    if (danger > 0) {
      const band = ctx.createLinearGradient(0, DANGER_Y - 40, 0, DANGER_Y + 60);
      band.addColorStop(0, `rgba(255, 60, 90, ${0.05 + danger * 0.16})`);
      band.addColorStop(1, 'rgba(255, 60, 90, 0)');
      ctx.fillStyle = band;
      ctx.fillRect(0, DANGER_Y - 40, WORLD_WIDTH, 100);
    }
  }

  private drawBodies(ctx: CanvasRenderingContext2D, game: BubbleMergeGame): void {
    const bodies = game.liveBubbles();
    for (const b of bodies) this.drawBubble(ctx, b, game.time);

    if (game.current && game.state === 'playing') {
      const def = game.current;
      const x = game.heldX();
      const bob = Math.sin(this.t * 3.2) * 5;
      const y = 104 + bob;
      ctx.save();
      ctx.setLineDash([6, 16]);
      ctx.strokeStyle = 'rgba(255, 230, 180, 0.22)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y + def.radius);
      ctx.lineTo(x, WORLD_HEIGHT - 8);
      ctx.stroke();
      ctx.restore();

      const ghost: GameBubble = {
        id: -1,
        def,
        x,
        y,
        vx: 0,
        vy: 0,
        r: def.radius,
        mass: 1,
        alive: true,
        bornAt: game.time - 1,
        mergeReadyAt: 0,
      };
      this.drawBubble(ctx, ghost, game.time, 0.96);
    }
  }

  private drawBubble(ctx: CanvasRenderingContext2D, b: GameBubble, now: number, alpha = 1): void {
    const age = now - b.bornAt;
    const pop = age < 0.22 ? 0.72 + 0.28 * (age / 0.22) + Math.sin((age / 0.22) * Math.PI) * 0.1 : 1;
    const r = b.r * pop;
    const img = this.images[b.def.sprite];

    ctx.save();
    ctx.globalAlpha = alpha;

    const glow = ctx.createRadialGradient(b.x, b.y, r * 0.6, b.x, b.y, r * 1.35);
    glow.addColorStop(0, `${hexToRgba(b.def.tint, 0.42)}`);
    glow.addColorStop(1, `${hexToRgba(b.def.tint, 0)}`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r * 1.35, 0, Math.PI * 2);
    ctx.fill();

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, b.x - r, b.y - r, r * 2, r * 2);
    } else {
      const fallback = ctx.createRadialGradient(b.x - r * 0.3, b.y - r * 0.35, r * 0.15, b.x, b.y, r);
      fallback.addColorStop(0, 'rgba(255,255,255,0.95)');
      fallback.addColorStop(0.5, b.def.tint);
      fallback.addColorStop(1, '#1a1030');
      ctx.fillStyle = fallback;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (b.def.chain === 'legend') {
      const aura = ctx.createRadialGradient(b.x, b.y, r * 0.8, b.x, b.y, r * 1.6);
      aura.addColorStop(0, 'rgba(255, 214, 110, 0.35)');
      aura.addColorStop(1, 'rgba(255, 214, 110, 0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r * 1.6, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 6; i++) {
        const a = this.t * 1.2 + (i * Math.PI) / 3;
        const sx = b.x + Math.cos(a) * r * 1.18;
        const sy = b.y + Math.sin(a) * r * 1.18;
        ctx.fillStyle = 'rgba(255, 240, 190, 0.85)';
        ctx.beginPath();
        ctx.arc(sx, sy, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawEffects(ctx: CanvasRenderingContext2D, dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += 520 * dt;
      p.vx *= 1 - 1.2 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const k = p.life / p.maxLife;
      ctx.globalAlpha = Math.max(0, k);
      ctx.fillStyle = p.color;
      if (p.kind === 'spark') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.6, p.size * k), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.8, p.size * (0.6 + k * 0.8)), 0, Math.PI * 2);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) {
        this.rings.splice(i, 1);
        continue;
      }
      const k = 1 - r.life / r.maxLife;
      ctx.globalAlpha = Math.max(0, 1 - k) * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - k * 0.6);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r + (r.maxR - r.r) * easeOut(k), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.floaters.splice(i, 1);
        continue;
      }
      const k = f.life / f.maxLife;
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.font = `800 ${f.size}px "Trebuchet MS", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(20, 12, 36, 0.75)';
      ctx.strokeText(f.text, f.x, f.y - (1 - k) * 46);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y - (1 - k) * 46);
    }
    ctx.globalAlpha = 1;
  }

  private drawSlowMotion(ctx: CanvasRenderingContext2D, game: BubbleMergeGame): void {
    const k = clamp(game.slowMo / 1.8, 0, 1);
    const g = ctx.createRadialGradient(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 80, WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_HEIGHT * 0.8);
    g.addColorStop(0, `rgba(255, 226, 150, ${0.05 + k * 0.06})`);
    g.addColorStop(1, `rgba(255, 180, 60, ${0.05 + k * 0.18})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  }
}

function easeOut(k: number): number {
  return 1 - Math.pow(1 - k, 3);
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const n = parseInt(clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
