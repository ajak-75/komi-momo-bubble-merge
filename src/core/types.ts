/** Shared types for the bubble-merge core (no DOM access in this folder). */

export type Chain = 'momo' | 'komi' | 'legend';

export type Lang = 'en' | 'ko';

export interface Localized {
  en: string;
  ko: string;
}

/** A collectable / playable bubble definition. */
export interface BubbleDef {
  /** Stable id used by the save file. */
  id: string;
  chain: Chain;
  /** 1..4 for the two evolution lines, 5 for the legendary fusion. */
  level: number;
  /** Sprite basename inside /assets/bubbles/. */
  sprite: string;
  name: Localized;
  radius: number;
  /** Score granted when this bubble is produced by a merge. */
  score: number;
  /** Glow colour used by the canvas renderer. */
  tint: string;
  /** Trophy-only entries never appear on the board. */
  special?: boolean;
  hint?: Localized;
}

export interface CircleBody {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  mass: number;
  alive: boolean;
}

export interface GameBubble extends CircleBody {
  def: BubbleDef;
  /** Seconds since the bubble entered the world. */
  bornAt: number;
  /** Merges are ignored until this timestamp (prevents double merges). */
  mergeReadyAt: number;
}

export type MergeKind = 'evolve' | 'absorb' | 'legend';

export interface MergeRule {
  kind: MergeKind;
  into?: BubbleDef;
  bonus?: number;
}

export type GameState = 'idle' | 'playing' | 'paused' | 'over';

export type GameEvent =
  | { type: 'drop'; def: BubbleDef; x: number; y: number }
  | { type: 'merge'; def: BubbleDef; x: number; y: number; combo: number; points: number }
  | { type: 'absorb'; def: BubbleDef; x: number; y: number; points: number }
  | { type: 'legendary'; def: BubbleDef; x: number; y: number; points: number }
  | { type: 'combo'; value: number; x: number; y: number }
  | { type: 'discover'; id: string }
  | { type: 'gameover'; score: number; best: boolean };
