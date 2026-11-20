import { describe, expect, it } from 'vitest';
import { PhysicsWorld } from '../src/core/physics';
import type { CircleBody } from '../src/core/types';

interface Body extends CircleBody {
  label: string;
}

function makeWorld(width = 720, height = 1280): PhysicsWorld<Body> {
  return new PhysicsWorld<Body>(width, height);
}

function body(world: PhysicsWorld<Body>, x: number, y: number, r: number, label = 'b'): Body {
  return {
    id: world.nextBodyId(),
    x,
    y,
    vx: 0,
    vy: 0,
    r,
    mass: r * r,
    alive: true,
    label,
  };
}

function run(world: PhysicsWorld<Body>, seconds: number, stepMs = 16.6667): void {
  const steps = Math.round((seconds * 1000) / stepMs);
  for (let i = 0; i < steps; i++) world.step(stepMs / 1000);
}

describe('physics world', () => {
  it('falls under gravity and comes to rest on the floor', () => {
    const world = makeWorld();
    const b = world.add(body(world, 360, 120, 40));
    run(world, 2);
    expect(b.y).toBeGreaterThan(1200);
    expect(b.y + b.r).toBeLessThanOrEqual(1280.001);
    expect(Math.abs(b.vy)).toBeLessThan(60);
  });

  it('keeps bubbles inside the left and right walls', () => {
    const world = makeWorld();
    const b = world.add(body(world, 360, 900, 50));
    b.vx = -3200;
    run(world, 1.5);
    expect(b.x - b.r).toBeGreaterThanOrEqual(-0.01);
    expect(b.x + b.r).toBeLessThanOrEqual(720.01);

    b.vx = 3200;
    run(world, 1.5);
    expect(b.x - b.r).toBeGreaterThanOrEqual(-0.01);
    expect(b.x + b.r).toBeLessThanOrEqual(720.01);
  });

  it('separates overlapping bubbles instead of letting them stack inside each other', () => {
    const world = makeWorld();
    const radii = [34, 34, 47, 47, 62, 62, 82, 82, 34, 47, 62, 82];
    radii.forEach((r, i) => {
      world.add(body(world, 340 + (i % 3) * 12, 900 - i * 6, r));
    });
    run(world, 3);
    expect(world.maxOverlap()).toBeLessThan(2);
    for (const b of world.bodies) {
      expect(b.y + b.r).toBeLessThanOrEqual(1280.5);
      expect(b.y - b.r).toBeGreaterThanOrEqual(-0.5);
    }
  });

  it('is deterministic for identical setups', () => {
    const build = (): PhysicsWorld<Body> => {
      const world = makeWorld();
      for (let i = 0; i < 8; i++) world.add(body(world, 200 + i * 30, 300 + i * 40, 34 + (i % 3) * 14));
      run(world, 2);
      return world;
    };
    const a = build();
    const b = build();
    a.bodies.forEach((bodyA, i) => {
      const bodyB = b.bodies[i];
      expect(bodyA.x).toBeCloseTo(bodyB.x, 6);
      expect(bodyA.y).toBeCloseTo(bodyB.y, 6);
    });
  });

  it('resizes the field without pushing bubbles outside the new bounds', () => {
    const world = makeWorld();
    const b = world.add(body(world, 700, 1200, 60));
    world.setSize(720, 1000);
    expect(b.y + b.r).toBeLessThanOrEqual(1000.001);
    expect(b.x + b.r).toBeLessThanOrEqual(720.001);
  });
});
