import type { Lang } from './types';
import { COLLECTION_ORDER } from './config';

export interface Settings {
  sfx: boolean;
  bgm: boolean;
  lang: Lang;
}

export interface SaveData {
  version: 1;
  best: number;
  discovered: string[];
  /** Bubbles found but not yet seen in the collection (NEW badge). */
  unseen: string[];
  settings: Settings;
  runs: number;
}

export interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const SAVE_KEY = 'kmb.save.v1';

export const DEFAULT_SETTINGS: Settings = { sfx: true, bgm: true, lang: 'en' };

export function defaultSave(): SaveData {
  return {
    version: 1,
    best: 0,
    discovered: [],
    unseen: [],
    settings: { ...DEFAULT_SETTINGS },
    runs: 0,
  };
}

const known = new Set(COLLECTION_ORDER);

function cleanIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) if (typeof v === 'string' && known.has(v) && !out.includes(v)) out.push(v);
  return out;
}

function cleanNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** Parses a save file, tolerating missing / damaged / older fields. */
export function parseSave(raw: string | null): SaveData {
  const base = defaultSave();
  if (!raw) return base;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return base;
  }
  if (!parsed || typeof parsed !== 'object') return base;
  const obj = parsed as Record<string, unknown>;
  const settings = (obj.settings ?? {}) as Record<string, unknown>;
  const lang = settings.lang === 'ko' ? 'ko' : settings.lang === 'en' ? 'en' : base.settings.lang;
  return {
    version: 1,
    best: cleanNumber(obj.best),
    discovered: cleanIds(obj.discovered),
    unseen: cleanIds(obj.unseen).filter((id) => cleanIds(obj.discovered).includes(id)),
    settings: {
      sfx: typeof settings.sfx === 'boolean' ? settings.sfx : base.settings.sfx,
      bgm: typeof settings.bgm === 'boolean' ? settings.bgm : base.settings.bgm,
      lang,
    },
    runs: Math.max(0, Math.floor(typeof obj.runs === 'number' && Number.isFinite(obj.runs) ? obj.runs : 0)),
  };
}

export function loadSave(store: Store): SaveData {
  try {
    return parseSave(store.getItem(SAVE_KEY));
  } catch {
    return defaultSave();
  }
}

export function writeSave(store: Store, data: SaveData): void {
  try {
    store.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    /* private mode / quota — the session still works, it just is not remembered */
  }
}

/** Merges a run's best score and discoveries into the save file (no run counter). */
export function mergeProgress(save: SaveData, score: number, discovered: Iterable<string>): SaveData {
  const merged = new Set(save.discovered);
  const unseen = new Set(save.unseen);
  for (const id of discovered) {
    if (!known.has(id)) continue;
    if (!merged.has(id)) {
      merged.add(id);
      unseen.add(id);
    }
  }
  return {
    ...save,
    best: Math.max(save.best, Math.floor(score)),
    discovered: COLLECTION_ORDER.filter((id) => merged.has(id)),
    unseen: COLLECTION_ORDER.filter((id) => unseen.has(id)),
  };
}

/** Merges a finished run into the save file. Returns the new save. */
export function commitRun(save: SaveData, score: number, discovered: Iterable<string>): SaveData {
  return { ...mergeProgress(save, score, discovered), runs: save.runs + 1 };
}

export function markSeen(save: SaveData): SaveData {
  return save.unseen.length === 0 ? save : { ...save, unseen: [] };
}
