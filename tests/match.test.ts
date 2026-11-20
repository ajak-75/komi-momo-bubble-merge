import { describe, expect, it } from 'vitest';
import { findCluster, findFloating, gridView } from '../src/core/match';
import type { Bubble } from '../src/core/types';

function bubble(row: number, col: number, color: Bubble['color']): Bubble {
  return { row, col, color };
}

describe('matching', () => {
  it('finds a run of touching same-coloured bubbles', () => {
    const grid = gridView([bubble(2, 3, 'red'), bubble(2, 4, 'red'), bubble(3, 3, 'red'), bubble(2, 5, 'mint')]);
    const cluster = findCluster(grid, { row: 2, col: 3 });
    expect(cluster).toHaveLength(3);
    expect(cluster).toContainEqual({ row: 3, col: 3 });
    expect(cluster).not.toContainEqual({ row: 2, col: 5 });
  });

  it('does not link through a gap', () => {
    const grid = gridView([bubble(0, 0, 'red'), bubble(0, 2, 'red'), bubble(1, 5, 'red')]);
    expect(findCluster(grid, { row: 0, col: 0 })).toEqual([{ row: 0, col: 0 }]);
  });

  it('returns nothing for an empty cell', () => {
    expect(findCluster(gridView([]), { row: 0, col: 0 })).toEqual([]);
  });

  it('reports bubbles that lost their path to the ceiling', () => {
    const grid = gridView([
      bubble(0, 0, 'red'),
      bubble(1, 0, 'mint'),
      // an island two rows below, touching nothing that hangs from the ceiling
      bubble(2, 5, 'sky'),
      bubble(3, 5, 'sky'),
    ]);
    const floating = findFloating(grid, 0);
    expect(floating).toEqual([
      { row: 2, col: 5 },
      { row: 3, col: 5 },
    ]);
  });

  it('keeps everything anchored to a full ceiling row', () => {
    const cells: Bubble[] = [];
    for (let col = 0; col < 8; col++) cells.push(bubble(0, col, 'mint'));
    for (let col = 0; col < 7; col++) cells.push(bubble(1, col, 'pink'));
    expect(findFloating(gridView(cells), 0)).toEqual([]);
  });
});
