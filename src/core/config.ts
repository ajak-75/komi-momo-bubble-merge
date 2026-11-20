/** Colours, level curve and board constants for the bubble shooter. */

import type { ColorDef, ColorId } from './types';

/**
 * Six bubbles cut from the official KOMI & MOMO glass-bubble art.
 *
 * The six were picked for a bubble shooter's first rule — one glance, one
 * colour — so every bubble has its own hue: violet, red, mint, pink, sky, gold.
 */
export const COLORS: Record<ColorId, ColorDef> = {
  violet: {
    id: 'violet',
    sprite: './assets/bubbles/violet.webp',
    tint: '#6A2BF5',
    glow: '#B492FF',
    name: { en: 'Paw', ko: '발바닥' },
  },
  red: {
    id: 'red',
    sprite: './assets/bubbles/red.webp',
    tint: '#DF1F33',
    glow: '#FF8F7E',
    name: { en: 'Flower', ko: '단청 꽃' },
  },
  mint: {
    id: 'mint',
    sprite: './assets/bubbles/mint.webp',
    tint: '#37D2A4',
    glow: '#9BF0D4',
    name: { en: 'Beret', ko: '베레모' },
  },
  pink: {
    id: 'pink',
    sprite: './assets/bubbles/pink.webp',
    tint: '#F0398F',
    glow: '#FFA5CF',
    name: { en: 'Ribbon', ko: '리본' },
  },
  sky: {
    id: 'sky',
    sprite: './assets/bubbles/sky.webp',
    tint: '#2FB8E8',
    glow: '#A9E6FF',
    name: { en: 'Hanbok', ko: '한복' },
  },
  gold: {
    id: 'gold',
    sprite: './assets/bubbles/gold.webp',
    tint: '#F0AE1E',
    glow: '#FFE59A',
    name: { en: 'Crown', ko: '황금 대왕' },
  },
};

export const COLOR_ORDER: ColorId[] = ['violet', 'red', 'mint', 'pink', 'sky', 'gold'];

/** Player-facing palette order in the tiny legend (kept short for mobile). */
export const ALL_COLORS = COLOR_ORDER;

export interface LevelConfig {
  level: number;
  rows: number;
  colors: ColorId[];
  /** Shots allowed before the ceiling pushes a new row down. */
  dropEvery: number;
}

/** Endless curve: a row more every second level, a colour more every third. */
export function levelConfig(level: number): LevelConfig {
  const n = Math.max(1, Math.floor(level));
  const rows = Math.min(12, 3 + Math.floor((n - 1) / 2));
  const colorCount = Math.min(COLOR_ORDER.length, 4 + Math.floor((n - 1) / 3));
  const dropEvery = Math.max(5, 9 - Math.floor((n - 1) / 2));
  return { level: n, rows, colors: COLOR_ORDER.slice(0, colorCount), dropEvery };
}

/* --------------------------------------------------------------- scoring */

export const POP_BASE = 10;
export const POP_EXTRA = 15;
export const DROP_POINTS = 25;
export const CLEAR_BONUS = 300;
export const MAX_MULTIPLIER = 4;

export function comboMultiplier(combo: number): number {
  if (combo <= 1) return 1;
  return Math.min(MAX_MULTIPLIER, 1 + (combo - 1) * 0.5);
}

/* ---------------------------------------------------------------- layout */

/** Space under the ceiling row reserved for the cannon and the next-bubble slot. */
export const LAUNCH_ZONE = 196;
/** Height of the danger line above the cannon. */
export const DEADLINE_GAP = 74;

export const SHOT_SPEED = 2700;
