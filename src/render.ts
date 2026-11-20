/**
 * Canvas renderer.
 *
 * The board is drawn in "world units": 720 wide, however tall the device
 * leaves room for. That keeps one coordinate system for the game logic, the
 * aim maths and the tests, and the renderer only has to apply one scale.
 */

import { BUBBLE_RADIUS, BUBBLE_DIAMETER, BOARD_WIDTH, cellX, cellY } from './core/hex';
import { COLORS } from './core/config';
import type { BubbleShooter } from './core/game';
import type { ColorId, Lang, Point } from './core/types';
import { t } from './i18n';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  ring: boolean;
  spin: number;
  rot: number;
}

interface Popup {
  x: number;
  y: number;
  life: number;
  max: number;
  text: string;
  color: string;
  size: number;
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private scale = 1;
  private worldH = 1560;
  private sprites = new Map<ColorId, HTMLImageElement>();
  private particles: Particle[] = [];
  private popups: Popup[] = [];
  private shakeAmt = 0;
  private stars: Array<{ x: number; y: number; r: number; phase: number }> = [];
  private time = 0;
  private flash = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('canvas 2d context unavailable');
    this.ctx = ctx;
    this.makeStars();
  }

  get worldHeight(): number {
    return this.worldH;
  }

  /** Preloads the six bubble sprites. Resolves when every one is decoded. */
  async load(): Promise<void> {
    const entries = Object.values(COLORS);
    await Promise.all(
      entries.map(
        (color) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.decoding = 'async';
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = color.sprite;
            this.sprites.set(color.id, img);
          }),
      ),
    );
  }

  resize(): number {
    const rect = this.canvas.getBoundingClientRect();
    const cssW = Math.max(240, rect.width);
    const cssH = Math.max(320, rect.height);
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    this.scale = (cssW * this.dpr) / BOARD_WIDTH;
    this.worldH = (cssH * this.dpr) / this.scale;
    return this.worldH;
  }

  /** Screen (client) point → world point. */
  toWorld(clientX: number, clientY: number): Point {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) * this.dpr) / this.scale;
    const y = ((clientY - rect.top) * this.dpr) / this.scale;
    return { x, y };
  }

  burst(x: number, y: number, color: string, count = 12, power = 1): void {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.42,
      max: 0.42,
      size: BUBBLE_RADIUS * 0.9 * power,
      color,
      ring: true,
      spin: 0,
      rot: 0,
    });
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = (180 + Math.random() * 320) * power;
      const life = 0.5 + Math.random() * 0.45;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life,
        max: life,
        size: 4 + Math.random() * 9 * power,
        color,
        ring: false,
        spin: (Math.random() - 0.5) * 12,
        rot: Math.random() * Math.PI,
      });
    }
  }

  popup(x: number, y: number, text: string, color: string, size = 34): void {
    this.popups.push({ x, y, life: 1.05, max: 1.05, text, color, size });
  }

  shake(amount: number): void {
    this.shakeAmt = Math.min(18, this.shakeAmt + amount);
  }

  flashScreen(amount = 0.4): void {
    this.flash = Math.max(this.flash, amount);
  }

  private makeStars(): void {
    const rng = (() => {
      let s = 20261120;
      return () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
      };
    })();
    this.stars = Array.from({ length: 44 }, () => ({
      x: rng() * BOARD_WIDTH,
      y: rng(),
      r: 0.8 + rng() * 1.8,
      phase: rng() * Math.PI * 2,
    }));
  }

  private drawSprite(id: ColorId, x: number, y: number, size = BUBBLE_DIAMETER, alpha = 1, rot = 0): void {
    const img = this.sprites.get(id);
    if (!img || !img.complete || img.naturalWidth === 0) {
      this.ctx.fillStyle = COLORS[id].tint;
      this.ctx.globalAlpha = alpha;
      this.ctx.beginPath();
      this.ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.globalAlpha = 1;
      return;
    }
    const ctx = this.ctx;
    ctx.globalAlpha = alpha;
    if (rot !== 0) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
      ctx.restore();
    } else {
      ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  /** Paints one frame. */
  render(game: BubbleShooter, dt: number, lang: Lang): void {
    const ctx = this.ctx;
    const step = Math.min(0.05, dt);
    this.time += step;

    for (const p of this.particles) {
      p.life -= step;
      if (!p.ring) {
        p.vy += 900 * step;
        p.x += p.vx * step;
        p.y += p.vy * step;
        p.vx *= 0.985;
        p.rot += p.spin * step;
      }
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.popups) {
      p.life -= step;
      p.y -= 62 * step;
    }
    this.popups = this.popups.filter((p) => p.life > 0);
    this.shakeAmt *= Math.pow(0.0016, step);
    this.flash = Math.max(0, this.flash - step * 1.8);

    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    const shakeX = (Math.random() - 0.5) * this.shakeAmt;
    const shakeY = (Math.random() - 0.5) * this.shakeAmt;
    ctx.translate(shakeX, shakeY);

    this.drawBackground();

    const pressure = game.pressure();
    this.drawDeadline(game, pressure, lang);
    this.drawCeiling();
    this.drawBoard(game);

    if (game.phase === 'ready' && !game.flying) this.drawAim(game);
    this.drawFalling(game);
    this.drawCannon(game, lang);
    this.drawFlying(game);
    this.drawParticles();
    this.drawPopups();

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,240,210,${this.flash * 0.35})`;
      ctx.fillRect(-40, -40, BOARD_WIDTH + 80, this.worldH + 80);
    }
  }

  private drawBackground(): void {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, this.worldH);
    g.addColorStop(0, '#1d1338');
    g.addColorStop(0.55, '#140d29');
    g.addColorStop(1, '#0a0718');
    ctx.fillStyle = g;
    ctx.fillRect(-60, -60, BOARD_WIDTH + 120, this.worldH + 120);

    const glow = ctx.createRadialGradient(BOARD_WIDTH / 2, this.worldH * 0.32, 40, BOARD_WIDTH / 2, this.worldH * 0.32, this.worldH * 0.62);
    glow.addColorStop(0, 'rgba(120,80,255,0.16)');
    glow.addColorStop(0.6, 'rgba(80,40,160,0.06)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, BOARD_WIDTH, this.worldH);

    for (const s of this.stars) {
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(this.time * 0.9 + s.phase));
      ctx.globalAlpha = 0.5 * tw;
      ctx.fillStyle = '#ffeccd';
      ctx.beginPath();
      ctx.arc(s.x, 120 + s.y * (this.worldH - 260), s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawCeiling(): void {
    const ctx = this.ctx;
    ctx.save();
    const grad = ctx.createLinearGradient(0, -6, 0, 34);
    grad.addColorStop(0, 'rgba(255,236,200,0.30)');
    grad.addColorStop(0.45, 'rgba(190,150,255,0.16)');
    grad.addColorStop(1, 'rgba(90,60,160,0.05)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, -6, BOARD_WIDTH, 40);
    ctx.strokeStyle = 'rgba(255,226,178,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 34);
    ctx.lineTo(BOARD_WIDTH, 34);
    ctx.stroke();
    // rivets on every column
    for (let col = 0; col < 8; col++) {
      const x = cellX(0, col);
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255,235,200,0.5)';
      ctx.arc(x, 20, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawDeadline(game: BubbleShooter, pressure: number, lang: Lang): void {
    const ctx = this.ctx;
    const y = game.deadlineY;
    const pulse = pressure > 0.55 ? 0.45 + 0.35 * Math.abs(Math.sin(this.time * 4)) : 0.24;
    ctx.save();
    ctx.setLineDash([16, 14]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(255,96,130,${pulse})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(BOARD_WIDTH, y);
    ctx.stroke();
    ctx.restore();
    if (pressure > 0.72) {
      ctx.save();
      ctx.font = '700 24px "Trebuchet MS", system-ui, sans-serif';
      ctx.fillStyle = `rgba(255,140,160,${0.5 + 0.4 * Math.abs(Math.sin(this.time * 5))})`;
      ctx.textAlign = 'right';
      ctx.fillText(t(lang, 'danger'), BOARD_WIDTH - 18, y - 14);
      ctx.restore();
    }
  }

  private drawBoard(game: BubbleShooter): void {
    const ctx = this.ctx;
    // soft bed behind the stack so the art's glass edge never sits on raw background
    ctx.save();
    for (const bubble of game.bubbles()) {
      const x = cellX(bubble.row, bubble.col);
      const y = cellY(bubble.row, game.topRow, game.ceilingY);
      ctx.fillStyle = 'rgba(10,6,24,0.55)';
      ctx.beginPath();
      ctx.arc(x, y + 3, BUBBLE_RADIUS - 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    for (const bubble of game.bubbles()) {
      this.drawSprite(bubble.color, cellX(bubble.row, bubble.col), cellY(bubble.row, game.topRow, game.ceilingY), BUBBLE_DIAMETER + 1);
    }
  }

  private drawAim(game: BubbleShooter): void {
    const ctx = this.ctx;
    const { trace, cell } = game.aim();
    const points = trace.points;
    const tint = COLORS[game.current].glow;

    // dotted path, fading with distance
    let travelled = 0;
    const spacing = 26;
    const total = trace.length;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const seg = Math.hypot(b.x - a.x, b.y - a.y);
      let d = 0;
      while (d < seg) {
        const t01 = d / seg;
        const x = a.x + (b.x - a.x) * t01;
        const y = a.y + (b.y - a.y) * t01;
        const along = travelled + d;
        const fade = Math.max(0.12, 1 - along / Math.max(520, total * 1.1));
        ctx.globalAlpha = 0.55 * fade;
        ctx.fillStyle = tint;
        ctx.beginPath();
        ctx.arc(x, y, 4.6 - 1.6 * (1 - fade), 0, Math.PI * 2);
        ctx.fill();
        d += spacing;
      }
      travelled += seg;
    }
    ctx.globalAlpha = 1;

    if (cell) {
      const cx = cellX(cell.row, cell.col);
      const cy = cellY(cell.row, game.topRow, game.ceilingY);
      ctx.save();
      ctx.setLineDash([8, 8]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.arc(cx, cy, BUBBLE_RADIUS - 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = COLORS[game.current].glow;
      ctx.beginPath();
      ctx.arc(cx, cy, BUBBLE_RADIUS - 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (trace.hitBubble) {
      // board is packed — mark what the shot would touch
      const c = trace.hitBubble;
      ctx.strokeStyle = 'rgba(255,120,140,0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(c.x, c.y, BUBBLE_RADIUS - 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawCannon(game: BubbleShooter, lang: Lang): void {
    const ctx = this.ctx;
    const px = game.launcherX;
    const py = game.launcherY;

    // pedestal
    ctx.save();
    const baseY = this.worldH - 54;
    const grad = ctx.createLinearGradient(px - 110, baseY, px + 110, baseY + 60);
    grad.addColorStop(0, 'rgba(70,40,120,0.85)');
    grad.addColorStop(0.5, 'rgba(120,80,190,0.95)');
    grad.addColorStop(1, 'rgba(60,32,104,0.85)');
    ctx.fillStyle = grad;
    roundRect(ctx, px - 104, baseY, 208, 62, 24);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,150,0.35)';
    ctx.lineWidth = 2;
    roundRect(ctx, px - 104, baseY, 208, 62, 24);
    ctx.stroke();

    // barrel points where the cannon aims
    const angle = game.angle;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    const barrel = ctx.createLinearGradient(0, -22, 0, 22);
    barrel.addColorStop(0, 'rgba(255,236,200,0.22)');
    barrel.addColorStop(0.5, 'rgba(190,160,255,0.30)');
    barrel.addColorStop(1, 'rgba(120,80,200,0.18)');
    ctx.fillStyle = barrel;
    roundRect(ctx, -20, -BUBBLE_RADIUS - 30, 40, BUBBLE_RADIUS + 30, 18);
    ctx.fill();
    ctx.restore();
    ctx.restore();

    // current bubble on the muzzle
    this.drawSprite(game.current, px, py, BUBBLE_DIAMETER * 1.02);

    // next bubble + swap affordance
    const nx = game.nextX;
    const ny = py;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.arc(nx, ny, BUBBLE_RADIUS * 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    this.drawSprite(game.next, nx, ny, BUBBLE_DIAMETER * 0.8);
    ctx.font = '700 16px "Trebuchet MS", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,235,205,0.75)';
    ctx.textAlign = 'center';
    ctx.fillText(t(lang, 'next'), nx, ny - BUBBLE_RADIUS * 1.5);

    // swap badge, kept left of the next bubble and clear of the firing lane
    const bx = nx - 76;
    const by = ny;
    ctx.fillStyle = 'rgba(255,214,150,0.16)';
    ctx.beginPath();
    ctx.arc(bx, by, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,150,0.55)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(bx, by, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ffd9a1';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(bx, by, 12, -0.4, Math.PI - 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(bx, by, 12, Math.PI - 0.4, Math.PI * 2 - 0.9);
    ctx.stroke();
    ctx.fillStyle = '#ffd9a1';
    triangle(ctx, bx + 12, by - 6, 6, -Math.PI / 2);
    triangle(ctx, bx - 12, by + 6, 6, Math.PI / 2);
    ctx.font = '700 11px "Trebuchet MS", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,235,205,0.7)';
    ctx.fillText(t(lang, 'swap'), bx, by + 44);
    ctx.restore();
  }

  private drawFlying(game: BubbleShooter): void {
    const pos = game.position();
    if (!pos || !game.flying) return;
    const color = game.flying.color;
    for (let i = 3; i >= 1; i--) {
      const back = pointAlong(game, i * 16);
      if (back) this.drawSprite(color, back.x, back.y, BUBBLE_DIAMETER * (1 - i * 0.06), 0.16 * (4 - i));
    }
    this.drawSprite(color, pos.x, pos.y, BUBBLE_DIAMETER);
  }

  private drawFalling(game: BubbleShooter): void {
    for (const f of game.falling) {
      const alpha = Math.min(1, f.life / 0.7);
      this.drawSprite(f.color, f.x, f.y, BUBBLE_DIAMETER * (0.9 + 0.1 * (1 - f.life / 2.4)), alpha, f.rot);
    }
  }

  private drawParticles(): void {
    const ctx = this.ctx;
    for (const p of this.particles) {
      const k = Math.max(0, p.life / p.max);
      if (p.ring) {
        ctx.globalAlpha = 0.5 * k;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 6 * k + 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.5 - k * 1.1), 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.globalAlpha = 0.9 * k;
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.62, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawPopups(): void {
    const ctx = this.ctx;
    for (const p of this.popups) {
      const k = p.life / p.max;
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.font = `800 ${p.size}px "Trebuchet MS", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(8,4,20,0.55)';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }
}

function pointAlong(game: BubbleShooter, back: number): Point | null {
  const shot = game.flying;
  if (!shot) return null;
  const d = Math.max(0, shot.travel - back);
  const pts = shot.trace.points;
  let travelled = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (travelled + seg >= d) {
      const t01 = seg === 0 ? 0 : (d - travelled) / seg;
      return { x: a.x + (b.x - a.x) * t01, y: a.y + (b.y - a.y) * t01 };
    }
    travelled += seg;
  }
  return null;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function triangle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, dir: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(dir);
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.72, size * 0.6);
  ctx.lineTo(-size * 0.72, size * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
