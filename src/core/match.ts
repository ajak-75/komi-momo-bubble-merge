/** Cluster search (3+ same colour pops) and floating-bubble detection. */

import { inBounds, cellKey, neighbors } from './hex';
import type { Cell, ColorId } from './types';

export interface GridView {
  at(row: number, col: number): ColorId | undefined;
  cells(): Cell[];
}

/** Reads a bubble list into a lookup so the searches stay pure and testable. */
export function gridView(bubbles: Iterable<{ row: number; col: number; color: ColorId }>): GridView {
  const map = new Map<string, ColorId>();
  for (const b of bubbles) map.set(cellKey(b.row, b.col), b.color);
  return {
    at: (row, col) => map.get(cellKey(row, col)),
    cells: () =>
      [...map.keys()].map((key) => {
        const [row, col] = key.split(',').map(Number);
        return { row, col };
      }),
  };
}

/** Every cell reachable from `start` through touching, same-coloured bubbles. */
export function findCluster(grid: GridView, start: Cell): Cell[] {
  const color = grid.at(start.row, start.col);
  if (color === undefined) return [];
  const seen = new Set<string>([cellKey(start.row, start.col)]);
  const out: Cell[] = [{ row: start.row, col: start.col }];
  const queue: Cell[] = [{ row: start.row, col: start.col }];
  while (queue.length) {
    const cur = queue.pop() as Cell;
    for (const [row, col] of neighbors(cur.row, cur.col)) {
      if (!inBounds(row, col)) continue;
      const key = cellKey(row, col);
      if (seen.has(key)) continue;
      if (grid.at(row, col) !== color) continue;
      seen.add(key);
      out.push({ row, col });
      queue.push({ row, col });
    }
  }
  return out;
}

/**
 * Cells that no longer hang from the ceiling row.
 *
 * Anything not reachable from a bubble in `topRow` through touching bubbles
 * falls out of the board (the drop bonus).
 */
export function findFloating(grid: GridView, topRow: number): Cell[] {
  const anchored = new Set<string>();
  const queue: Array<[number, number]> = [];
  const all = grid.cells();
  for (const cell of all) {
    if (cell.row !== topRow) continue;
    anchored.add(cellKey(cell.row, cell.col));
    queue.push([cell.row, cell.col]);
  }
  while (queue.length) {
    const [row, col] = queue.pop() as [number, number];
    for (const [r, c] of neighbors(row, col)) {
      if (!inBounds(r, c)) continue;
      const key = cellKey(r, c);
      if (anchored.has(key)) continue;
      if (grid.at(r, c) === undefined) continue;
      anchored.add(key);
      queue.push([r, c]);
    }
  }
  return all.filter((cell) => !anchored.has(cellKey(cell.row, cell.col)));
}
