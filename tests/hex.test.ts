import { describe, expect, it } from 'vitest';
import {
  BOARD_WIDTH,
  BUBBLE_DIAMETER,
  BUBBLE_RADIUS,
  ROW_HEIGHT,
  cellFromPoint,
  cellKey,
  cellX,
  cellY,
  centerDistance,
  colsInRow,
  inBounds,
  neighbors,
  rowOffset,
} from '../src/core/hex';

describe('hex lattice', () => {
  it('alternates long (8) and inset (7) rows', () => {
    expect(rowOffset(0)).toBe(0);
    expect(rowOffset(1)).toBe(1);
    expect(colsInRow(0)).toBe(8);
    expect(colsInRow(1)).toBe(7);
    expect(colsInRow(4)).toBe(8);
    expect(colsInRow(-1)).toBe(7);
  });

  it('keys cells by row and column', () => {
    expect(cellKey(2, 3)).toBe('2,3');
    expect(cellKey(-1, 0)).not.toBe(cellKey(1, 0));
  });

  it('keeps every row inside the board walls', () => {
    for (const row of [-2, -1, 0, 1, 2, 3]) {
      for (let col = 0; col < colsInRow(row); col++) {
        const x = cellX(row, col);
        expect(x - BUBBLE_RADIUS).toBeGreaterThanOrEqual(-1e-9);
        expect(x + BUBBLE_RADIUS).toBeLessThanOrEqual(BOARD_WIDTH + 1e-9);
      }
    }
  });

  it('stacks rows one hex height apart', () => {
    expect(cellY(1, 0, 0) - cellY(0, 0, 0)).toBeCloseTo(ROW_HEIGHT, 6);
    expect(cellY(0, 0, 0)).toBeCloseTo(BUBBLE_RADIUS, 6);
    expect(cellY(3, 2, 40)).toBeCloseTo(40 + BUBBLE_RADIUS + ROW_HEIGHT, 6);
  });

  it('puts every neighbour exactly one bubble diameter away', () => {
    for (const [row, col] of [
      [0, 3],
      [1, 3],
      [5, 0],
    ]) {
      for (const [r, c] of neighbors(row, col)) {
        expect(inBounds(r, c)).toBe(true);
        expect(centerDistance(row, col, r, c)).toBeCloseTo(BUBBLE_DIAMETER, 5);
      }
    }
  });

  it('gives a middle cell six neighbours and an edge cell fewer', () => {
    expect(neighbors(2, 3)).toHaveLength(6);
    expect(neighbors(0, 0)).toHaveLength(3);
    expect(neighbors(0, 7)).toHaveLength(3);
  });

  it('round-trips cell centres through cellFromPoint', () => {
    for (const row of [0, 1, 2, 3, 4]) {
      for (let col = 0; col < colsInRow(row); col++) {
        const point = cellFromPoint(cellX(row, col), cellY(row, 0, 0), 0, 0);
        expect(point).toEqual({ row, col });
      }
    }
  });

  it('clamps a point outside the walls into the row', () => {
    expect(cellFromPoint(-400, 45, 0, 0)).toEqual({ row: 0, col: 0 });
    expect(cellFromPoint(2000, 45, 0, 0)).toEqual({ row: 0, col: 7 });
  });
});
