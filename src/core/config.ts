import type { BubbleDef } from './types';

/** Virtual 9:16 play field. The renderer scales it to the device. */
export const WORLD_WIDTH = 720;
export const WORLD_HEIGHT = 1280;
export const MIN_WORLD_HEIGHT = 1120;
export const MAX_WORLD_HEIGHT = 1560;

/** Y of the top of the game-over line (world units). */
export const DANGER_Y = 176;
/** Seconds a bubble may sit above the line before the run ends. */
export const DANGER_SECONDS = 2.2;

export const GRAVITY = 1500;
export const WALL_RESTITUTION = 0.24;
export const BUBBLE_RESTITUTION = 0.18;
export const BUBBLE_FRICTION = 0.12;
/** Overlap (as a fraction of the summed radii) that counts as a merge contact. */
export const MERGE_CONTACT = 0.965;
/** Drop height / initial speed. */
export const DROP_Y = 104;
export const DROP_SPEED = 220;
export const DROP_COOLDOWN = 0.36;
/** Combo window in seconds. */
export const COMBO_WINDOW = 1.5;
export const MAX_COMBO = 8;
/** Absorption score for two max-tier bubbles of the same line. */
export const ABSORB_BONUS = 50;
/** Score for the legendary fusion. */
export const LEGENDARY_BONUS = 150;

const R1 = 34;
const R2 = 47;
const R3 = 62;
const R4 = 82;
const RL = 106;

/** The two independent evolution lines plus the legendary fusion. */
export const MOMO_LINE: BubbleDef[] = [
  {
    id: 'momo-1',
    chain: 'momo',
    level: 1,
    sprite: 'momo_paw',
    name: { en: 'MOMO PAW', ko: '모모 발바닥' },
    radius: R1,
    score: 1,
    tint: '#8b5cf6',
  },
  {
    id: 'momo-2',
    chain: 'momo',
    level: 2,
    sprite: 'momo_basic',
    name: { en: 'MOMO BASIC', ko: '모모 베이직' },
    radius: R2,
    score: 3,
    tint: '#3b82f6',
  },
  {
    id: 'momo-3',
    chain: 'momo',
    level: 3,
    sprite: 'momo_costume',
    name: { en: 'MOMO COSTUME', ko: '모모 코스튬' },
    radius: R3,
    score: 8,
    tint: '#22c55e',
  },
  {
    id: 'momo-4',
    chain: 'momo',
    level: 4,
    sprite: 'momo_royal',
    name: { en: 'MOMO ROYAL', ko: '모모 로열' },
    radius: R4,
    score: 20,
    tint: '#3d5cff',
  },
];

export const KOMI_LINE: BubbleDef[] = [
  {
    id: 'komi-1',
    chain: 'komi',
    level: 1,
    sprite: 'komi_flower',
    name: { en: 'KOMI FLOWER', ko: '코미 꽃' },
    radius: R1,
    score: 1,
    tint: '#e11d48',
  },
  {
    id: 'komi-2',
    chain: 'komi',
    level: 2,
    sprite: 'komi_basic',
    name: { en: 'KOMI BASIC', ko: '코미 베이직' },
    radius: R2,
    score: 3,
    tint: '#ec4899',
  },
  {
    id: 'komi-3',
    chain: 'komi',
    level: 3,
    sprite: 'komi_costume',
    name: { en: 'KOMI COSTUME', ko: '코미 코스튬' },
    radius: R3,
    score: 8,
    tint: '#a855f7',
  },
  {
    id: 'komi-4',
    chain: 'komi',
    level: 4,
    sprite: 'komi_royal',
    name: { en: 'KOMI ROYAL', ko: '코미 로열' },
    radius: R4,
    score: 20,
    tint: '#f43f5e',
  },
];

export const LEGENDARY: BubbleDef = {
  id: 'legend',
  chain: 'legend',
  level: 5,
  sprite: 'legendary',
  name: { en: 'LEGENDARY KOMI & MOMO', ko: '레전더리 코미 & 모모' },
  radius: RL,
  score: LEGENDARY_BONUS,
  tint: '#f5c451',
};

/** Trophy bubbles: they live only in the collection, unlocked by milestones. */
export const TROPHY_HANBOK: BubbleDef = {
  id: 'komi-hanbok',
  chain: 'komi',
  level: 0,
  sprite: 'komi_hanbok',
  name: { en: 'KOMI HANBOK', ko: '코미 한복' },
  radius: R4,
  score: 0,
  tint: '#38bdf8',
  special: true,
  hint: { en: 'Score 2,000 in one run', ko: '한 판에 2,000점 달성' },
};

export const TROPHY_GOLD: BubbleDef = {
  id: 'komi-gold',
  chain: 'komi',
  level: 0,
  sprite: 'komi_gold',
  name: { en: 'GOLDEN KOMI', ko: '골든 코미' },
  radius: R4,
  score: 0,
  tint: '#fbbf24',
  special: true,
  hint: { en: 'Fuse a LEGENDARY bubble', ko: '레전더리 버블 합체 성공' },
};

/** Everything that can be discovered, in collection order. */
export const COLLECTION_ORDER: string[] = [
  'momo-1',
  'momo-2',
  'momo-3',
  'momo-4',
  'komi-1',
  'komi-2',
  'komi-3',
  'komi-4',
  'legend',
  'komi-hanbok',
  'komi-gold',
];

export const ALL_DEFS: BubbleDef[] = [
  ...MOMO_LINE,
  ...KOMI_LINE,
  LEGENDARY,
  TROPHY_HANBOK,
  TROPHY_GOLD,
];

const DEF_BY_ID = new Map<string, BubbleDef>(ALL_DEFS.map((d) => [d.id, d]));

export function defById(id: string): BubbleDef {
  const d = DEF_BY_ID.get(id);
  if (!d) throw new Error(`unknown bubble id: ${id}`);
  return d;
}

export function lineOf(chain: 'momo' | 'komi'): BubbleDef[] {
  return chain === 'momo' ? MOMO_LINE : KOMI_LINE;
}
