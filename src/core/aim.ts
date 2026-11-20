/**
 * Aiming and shot tracing.
 *
 * A shot is traced once, when it leaves the cannon: a straight line that
 * reflects off the two side walls until it meets the ceiling or a bubble. The
 * flying bubble then walks that same polyline, so what the dotted guide showed
 * is exactly what the shot does — and the whole thing is testable in Node.
 */

import { BOARD_WIDTH, BUBBLE_RADIUS, BUBBLE_DIAMETER } from './hex';
import type { Point } from './types';

/** 0 rad points straight up; positive angles lean right. */
export const MAX_AIM_ANGLE = (75 * Math.PI) / 180;

export interface BubbleCircle extends Point {
  row: number;
  col: number;
}

export interface TraceOptions {
  from: Point;
  angle: number;
  ceilingY: number;
  bubbles: Iterable<BubbleCircle>;
  maxBounces?: number;
  maxLength?: number;
  /** Collision distance between two bubble centres. */
  contact?: number;
}

export interface TraceResult {
  points: Point[];
  length: number;
  /** Distance along the path at each wall bounce (for the bounce sound). */
  bounceLengths: number[];
  hit: Point;
  hitBubble: BubbleCircle | null;
  bounces: number;
  /** True when the shot ended on the ceiling instead of on a bubble. */
  ceiling: boolean;
}

const EPS = 1e-6;

export function directionFromAngle(angle: number): Point {
  return { x: Math.sin(angle), y: -Math.cos(angle) };
}

export function clampAngle(angle: number): number {
  if (Number.isNaN(angle)) return 0;
  return Math.max(-MAX_AIM_ANGLE, Math.min(MAX_AIM_ANGLE, angle));
}

/** Angle that points from the cannon at a touch / mouse position. */
export function angleToPoint(from: Point, to: Point): number {
  return clampAngle(Math.atan2(to.x - from.x, from.y - to.y));
}

/** Walks the polyline of a traced shot to the point `distance` along it. */
export function pointAtDistance(points: Point[], distance: number): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (distance <= 0) return points[0];
  let travelled = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg <= EPS) continue;
    if (travelled + seg >= distance) {
      const t = (distance - travelled) / seg;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    travelled += seg;
  }
  return points[points.length - 1];
}

export function pathLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

export function traceShot(opts: TraceOptions): TraceResult {
  const contact = opts.contact ?? BUBBLE_DIAMETER * 0.98;
  const maxBounces = opts.maxBounces ?? 4;
  const maxLength = opts.maxLength ?? 8000;
  const left = BUBBLE_RADIUS;
  const right = BOARD_WIDTH - BUBBLE_RADIUS;
  const ceiling = opts.ceilingY + BUBBLE_RADIUS;
  const circles = [...opts.bubbles];
  const reach = contact * contact;

  let x = opts.from.x;
  let y = opts.from.y;
  const dir = directionFromAngle(opts.angle);
  let dx = dir.x;
  let dy = dir.y;
  const points: Point[] = [{ x, y }];
  const bounceLengths: number[] = [];
  let travelled = 0;
  let bounces = 0;

  for (let guard = 0; guard < 24; guard++) {
    let bestT = Number.POSITIVE_INFINITY;
    let hitBubble: BubbleCircle | null = null;
    let hitCeiling = false;
    let hitWall = false;

    if (dy < -EPS) {
      const t = (ceiling - y) / dy;
      if (t > EPS && t < bestT) {
        bestT = t;
        hitCeiling = true;
        hitBubble = null;
      }
    }

    for (const c of circles) {
      const ox = c.x - x;
      const oy = c.y - y;
      const proj = ox * dx + oy * dy;
      if (proj <= 0) continue;
      const perp2 = ox * ox + oy * oy - proj * proj;
      if (perp2 > reach) continue;
      const t = proj - Math.sqrt(reach - perp2);
      if (t > EPS && t < bestT) {
        bestT = t;
        hitBubble = c;
        hitCeiling = false;
      }
    }

    if (dx > EPS) {
      const t = (right - x) / dx;
      if (t > EPS && t < bestT) {
        bestT = t;
        hitWall = true;
        hitCeiling = false;
        hitBubble = null;
      }
    } else if (dx < -EPS) {
      const t = (left - x) / dx;
      if (t > EPS && t < bestT) {
        bestT = t;
        hitWall = true;
        hitCeiling = false;
        hitBubble = null;
      }
    }

    if (!Number.isFinite(bestT)) break;

    if (travelled + bestT > maxLength) {
      x += dx * (maxLength - travelled);
      y += dy * (maxLength - travelled);
      points.push({ x, y });
      travelled = maxLength;
      break;
    }

    x += dx * bestT;
    y += dy * bestT;
    travelled += bestT;
    points.push({ x, y });

    if (hitWall) {
      dx = -dx;
      bounces += 1;
      bounceLengths.push(travelled);
      if (bounces > maxBounces) break;
      continue;
    }

    return {
      points,
      length: travelled,
      bounceLengths,
      hit: { x, y },
      hitBubble,
      bounces,
      ceiling: hitCeiling,
    };
  }

  return {
    points,
    length: travelled,
    bounceLengths,
    hit: { x, y },
    hitBubble: null,
    bounces,
    ceiling: false,
  };
}
