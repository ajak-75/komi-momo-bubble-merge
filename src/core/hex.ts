/**
 * Hex lattice geometry for the bubble board.
 *
 * The board is 720 world units wide (the renderer scales it to the device), with
 * bubbles of radius 45. Rows alternate between two offsets so the bubbles pack
 * like a honeycomb:
 *
 *   row 0 (even, offset 0)  ● ● ● ● ● ● ● ●     8 bubbles, centres at 45 + 90n
 *   row 1 (odd,  offset 1)   ● ● ● ● ● ● ●      7 bubbles, centres at 90 + 90n
 *
 * A row's offset comes from its own index, so inserting a row above the board
 * (the pressure "row drop") needs no re-indexing at all: the new row simply
 * takes the free offset and every existing bubble keeps its column and slides
 * down by exactly one row height.
 */

export const BOARD_WIDTH = 720;
export const BUBBLE_RADIUS = 45;
export const BUBBLE_DIAMETER = BUBBLE_RADIUS * 2;
/** Height of one hexagonal row: 90 * √3/2 ≈ 77.94. */
export const ROW_HEIGHT = (BUBBLE_DIAMETER * Math.sqrt(3)) / 2;

/** Rows whose offset is 0 fit 8 bubbles, offset-1 rows fit 7. */
export const LONG_ROW_COLS = 8;
export const SHORT_ROW_COLS = 7;

export function mod2(n: number): 0 | 1 {
  return (((n % 2) + 2) % 2) as 0 | 1;
}

/** 0 for "long" rows (starts flush with the wall), 1 for inset rows. */
export function rowOffset(row: number): 0 | 1 {
  return mod2(row);
}

export function colsInRow(row: number): number {
  return rowOffset(row) === 0 ? LONG_ROW_COLS : SHORT_ROW_COLS;
}

/** Centre x of a cell in world units. */
export function cellX(row: number, col: number): number {
  return BUBBLE_RADIUS + col * BUBBLE_DIAMETER + rowOffset(row) * BUBBLE_RADIUS;
}

/** Centre y of a cell: the ceiling row sits one radius below the ceiling line. */
export function cellY(row: number, topRow: number, ceilingY: number): number {
  return ceilingY + BUBBLE_RADIUS + (row - topRow) * ROW_HEIGHT;
}

export function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

export function inBounds(row: number, col: number): boolean {
  return col >= 0 && col < colsInRow(row);
}

/**
 * The up to six cells that touch a cell.
 *
 * A long row (offset 0) has its inset neighbours one column to the left
 * (c-1, c); an inset row (offset 1) has them one column to the right (c, c+1).
 */
export function neighbors(row: number, col: number): Array<[number, number]> {
  const out: Array<[number, number]> = [
    [row, col - 1],
    [row, col + 1],
  ];
  const below = rowOffset(row) === 0 ? -1 : 0;
  out.push([row - 1, col + below], [row - 1, col + below + 1]);
  out.push([row + 1, col + below], [row + 1, col + below + 1]);
  return out.filter(([r, c]) => inBounds(r, c));
}

/** The cell whose centre is closest to a world point (clamped into the row). */
export function cellFromPoint(
  x: number,
  y: number,
  topRow: number,
  ceilingY: number,
): { row: number; col: number } {
  const row = Math.round((y - ceilingY - BUBBLE_RADIUS) / ROW_HEIGHT) + topRow;
  const rawCol = Math.round((x - BUBBLE_RADIUS - rowOffset(row) * BUBBLE_RADIUS) / BUBBLE_DIAMETER);
  const col = Math.min(colsInRow(row) - 1, Math.max(0, rawCol));
  return { row, col };
}

/** Distance between two neighbouring cell centres (the bubble diameter). */
export function centerDistance(rowA: number, colA: number, rowB: number, colB: number): number {
  const dx = cellX(rowA, colA) - cellX(rowB, colB);
  const dy = (rowA - rowB) * ROW_HEIGHT;
  return Math.hypot(dx, dy);
}
