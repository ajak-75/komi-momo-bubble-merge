import type { CircleBody } from './types';

export interface PhysicsOptions {
  gravity?: number;
  wallRestitution?: number;
  restitution?: number;
  friction?: number;
  /** Solver iterations per substep. */
  iterations?: number;
  substeps?: number;
}

/**
 * A small, deterministic 2D circle physics world.
 *
 * Only circles are needed for a merge puzzle, so instead of a general engine this
 * implements exactly the behaviour the game relies on: gravity, wall bounces,
 * non-overlapping circle contacts, restitution, tangential friction, drag and a
 * hard speed cap (no tunnelling through the floor or through other bubbles).
 */
export class PhysicsWorld<B extends CircleBody> {
  width: number;
  height: number;
  gravity: number;
  wallRestitution: number;
  restitution: number;
  friction: number;
  iterations: number;
  substeps: number;
  bodies: B[] = [];
  private nextId = 1;

  constructor(width: number, height: number, opts: PhysicsOptions = {}) {
    this.width = width;
    this.height = height;
    this.gravity = opts.gravity ?? 1500;
    this.wallRestitution = opts.wallRestitution ?? 0.24;
    this.restitution = opts.restitution ?? 0.18;
    this.friction = opts.friction ?? 0.12;
    this.iterations = opts.iterations ?? 2;
    this.substeps = opts.substeps ?? 3;
  }

  nextBodyId(): number {
    return this.nextId++;
  }

  add(body: B): B {
    this.bodies.push(body);
    return body;
  }

  remove(id: number): void {
    const i = this.bodies.findIndex((b) => b.id === id);
    if (i >= 0) this.bodies.splice(i, 1);
  }

  clear(): void {
    this.bodies.length = 0;
  }

  /** Resize the field (responsive layout). Bubbles are kept inside. */
  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    for (const b of this.bodies) {
      if (b.x - b.r < 0) {
        b.x = b.r;
        if (b.vx < 0) b.vx = 0;
      }
      if (b.x + b.r > width) {
        b.x = width - b.r;
        if (b.vx > 0) b.vx = 0;
      }
      if (b.y + b.r > height) {
        b.y = height - b.r;
        if (b.vy > 0) b.vy = 0;
      }
    }
  }

  step(dt: number): void {
    if (dt <= 0) return;
    const sub = Math.max(1, this.substeps);
    const h = dt / sub;
    for (let s = 0; s < sub; s++) {
      this.integrate(h);
      this.solveWalls();
      for (let i = 0; i < this.iterations; i++) this.solveContacts();
      // Contacts can push a bubble slightly through a wall, so clamp once more.
      this.solveWalls();
    }
  }

  private integrate(h: number): void {
    const dragX = Math.max(0, 1 - 0.35 * h);
    const dragY = Math.max(0, 1 - 0.05 * h);
    for (const b of this.bodies) {
      if (!b.alive) continue;
      b.vy += this.gravity * h;
      b.vx *= dragX;
      b.vy *= dragY;
      const maxSpeed = 2600;
      if (b.vy > maxSpeed) b.vy = maxSpeed;
      if (b.vy < -maxSpeed) b.vy = -maxSpeed;
      if (b.vx > maxSpeed) b.vx = maxSpeed;
      if (b.vx < -maxSpeed) b.vx = -maxSpeed;
      b.x += b.vx * h;
      b.y += b.vy * h;
    }
  }

  private solveWalls(): void {
    for (const b of this.bodies) {
      if (!b.alive) continue;
      if (b.x - b.r < 0) {
        b.x = b.r;
        if (b.vx < 0) b.vx = -b.vx * this.wallRestitution;
      } else if (b.x + b.r > this.width) {
        b.x = this.width - b.r;
        if (b.vx > 0) b.vx = -b.vx * this.wallRestitution;
      }
      if (b.y + b.r > this.height) {
        b.y = this.height - b.r;
        if (b.vy > 0) {
          const impact = b.vy;
          b.vy = -impact * this.wallRestitution;
          // ground friction
          b.vx *= Math.max(0, 1 - 2.2 * this.friction);
        }
      }
      if (b.y - b.r < 0) {
        b.y = b.r;
        if (b.vy < 0) b.vy = -b.vy * this.wallRestitution;
      }
    }
  }

  private solveContacts(): void {
    const list = this.bodies;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (!b.alive) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const minDist = a.r + b.r;
        let d2 = dx * dx + dy * dy;
        if (d2 >= minDist * minDist) continue;
        let dist = Math.sqrt(d2);
        if (dist < 0.0001) {
          // Perfectly stacked centres: nudge deterministically instead of dividing by 0.
          dx = 0.01;
          dy = 0.01;
          dist = 0.01414;
        }
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = minDist - dist;
        const total = a.mass + b.mass;
        const aShare = b.mass / total;
        const bShare = a.mass / total;
        // Positional correction (the "no overlap" guarantee).
        a.x -= nx * overlap * aShare;
        a.y -= ny * overlap * aShare;
        b.x += nx * overlap * bShare;
        b.y += ny * overlap * bShare;

        // Impulse along the contact normal.
        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const normalSpeed = rvx * nx + rvy * ny;
        if (normalSpeed < 0) {
          const invA = 1 / a.mass;
          const invB = 1 / b.mass;
          const restitution = -normalSpeed > 70 ? this.restitution : 0;
          const jImpulse = (-(1 + restitution) * normalSpeed) / (invA + invB);
          a.vx -= jImpulse * nx * invA;
          a.vy -= jImpulse * ny * invA;
          b.vx += jImpulse * nx * invB;
          b.vy += jImpulse * ny * invB;

          // Tangential friction keeps piles from sliding forever.
          const tx = -ny;
          const ty = nx;
          const tangentSpeed = rvx * tx + rvy * ty;
          const jt = (-tangentSpeed * this.friction) / (invA + invB);
          a.vx -= jt * tx * invA;
          a.vy -= jt * ty * invA;
          b.vx += jt * tx * invB;
          b.vy += jt * ty * invB;
        }
      }
    }
  }

  /** Smallest gap between two live bubbles (used by tests). */
  maxOverlap(): number {
    let worst = 0;
    for (let i = 0; i < this.bodies.length; i++) {
      for (let j = i + 1; j < this.bodies.length; j++) {
        const a = this.bodies[i];
        const b = this.bodies[j];
        if (!a.alive || !b.alive) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const gap = a.r + b.r - Math.sqrt(dx * dx + dy * dy);
        if (gap > worst) worst = gap;
      }
    }
    return worst;
  }
}
