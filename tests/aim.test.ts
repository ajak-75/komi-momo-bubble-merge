import { describe, expect, it } from 'vitest';
import {
  MAX_AIM_ANGLE,
  angleToPoint,
  clampAngle,
  directionFromAngle,
  pathLength,
  pointAtDistance,
  traceShot,
} from '../src/core/aim';
import { BOARD_WIDTH, BUBBLE_RADIUS } from '../src/core/hex';

describe('aim', () => {
  it('aims straight up at 0 rad and leans right for positive angles', () => {
    const up = directionFromAngle(0);
    expect(up.x).toBeCloseTo(0, 6);
    expect(up.y).toBeCloseTo(-1, 6);

    const right = directionFromAngle(Math.PI / 4);
    expect(right.x).toBeGreaterThan(0);
    expect(right.y).toBeLessThan(0);
  });

  it('clamps the aim to 75 degrees each way', () => {
    expect(clampAngle(Math.PI)).toBeCloseTo(MAX_AIM_ANGLE, 6);
    expect(clampAngle(-Math.PI)).toBeCloseTo(-MAX_AIM_ANGLE, 6);
    expect(clampAngle(0.3)).toBeCloseTo(0.3, 6);
    expect(clampAngle(Number.NaN)).toBe(0);
  });

  it('derives the angle from a touch point', () => {
    const from = { x: 360, y: 900 };
    expect(angleToPoint(from, { x: 360, y: 300 })).toBeCloseTo(0, 6);
    expect(angleToPoint(from, { x: 500, y: 300 })).toBeGreaterThan(0);
    expect(angleToPoint(from, { x: 650, y: 900 })).toBeCloseTo(MAX_AIM_ANGLE, 6);
    expect(angleToPoint(from, { x: 0, y: 900 })).toBeCloseTo(-MAX_AIM_ANGLE, 6);
  });

  it('walks a polyline by distance', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 0, y: 100 },
      { x: 100, y: 100 },
    ];
    expect(pathLength(points)).toBeCloseTo(200, 6);
    expect(pointAtDistance(points, 50)).toEqual({ x: 0, y: 50 });
    expect(pointAtDistance(points, 150)).toEqual({ x: 50, y: 100 });
    expect(pointAtDistance(points, 9999)).toEqual({ x: 100, y: 100 });
  });

  it('stops a straight shot on the ceiling', () => {
    const trace = traceShot({
      from: { x: BOARD_WIDTH / 2, y: 900 },
      angle: 0,
      ceilingY: 0,
      bubbles: [],
    });
    expect(trace.ceiling).toBe(true);
    expect(trace.hitBubble).toBeNull();
    expect(trace.bounces).toBe(0);
    expect(trace.hit.y).toBeCloseTo(BUBBLE_RADIUS, 5);
    expect(trace.hit.x).toBeCloseTo(BOARD_WIDTH / 2, 5);
  });

  it('bounces off a side wall and stays inside the board', () => {
    const trace = traceShot({
      from: { x: BOARD_WIDTH / 2, y: 1400 },
      angle: (60 * Math.PI) / 180,
      ceilingY: 0,
      bubbles: [],
    });
    expect(trace.bounces).toBeGreaterThanOrEqual(1);
    expect(trace.bounceLengths).toHaveLength(trace.bounces);
    for (const p of trace.points) {
      expect(p.x).toBeGreaterThanOrEqual(BUBBLE_RADIUS - 1e-6);
      expect(p.x).toBeLessThanOrEqual(BOARD_WIDTH - BUBBLE_RADIUS + 1e-6);
    }
    expect(trace.length).toBeCloseTo(
      trace.points.reduce(
        (sum, p, i) => (i === 0 ? 0 : sum + Math.hypot(p.x - trace.points[i - 1].x, p.y - trace.points[i - 1].y)),
        0,
      ),
      4,
    );
  });

  it('stops on the first bubble in its path', () => {
    const bubble = { x: BOARD_WIDTH / 2, y: 300, row: 3, col: 3 };
    const trace = traceShot({
      from: { x: BOARD_WIDTH / 2, y: 900 },
      angle: 0,
      ceilingY: 0,
      bubbles: [bubble],
    });
    expect(trace.hitBubble).toBe(bubble);
    expect(trace.ceiling).toBe(false);
    expect(Math.hypot(trace.hit.x - bubble.x, trace.hit.y - bubble.y)).toBeLessThanOrEqual(BUBBLE_RADIUS * 2);
    expect(trace.hit.y).toBeGreaterThan(bubble.y);
  });
});
