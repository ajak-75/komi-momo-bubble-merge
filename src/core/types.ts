/** Shared types for the KOMI & MOMO bubble shooter. */

export type Lang = 'en' | 'ko';

export type ColorId = 'violet' | 'red' | 'mint' | 'pink' | 'sky' | 'gold';

/** A bubble colour: the sprite it draws with and the tint used for effects. */
export interface ColorDef {
  id: ColorId;
  sprite: string;
  tint: string;
  glow: string;
  name: { en: string; ko: string };
}

/** Grid coordinates. `row` counts from the ceiling row (which can go negative as rows drop). */
export interface Cell {
  row: number;
  col: number;
}

export interface Bubble extends Cell {
  color: ColorId;
}

export interface Point {
  x: number;
  y: number;
}

/** A bubble that popped or fell and is now animating out of the board. */
export interface FallingBubble {
  color: ColorId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  life: number;
}

export type Phase = 'ready' | 'flying' | 'cleared' | 'over';
