import type { Lang } from './types';

export interface Settings {
  sfx: boolean;
  bgm: boolean;
  lang: Lang;
}

export interface SaveData {
  version: 2;
  best: number;
  /** Highest stage reached, so the menu can offer "continue". */
  level: number;
  runs: number;
  settings: Settings;
}

export interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const SAVE_KEY = 'kmb.save.v2';

export function defaultLang(): Lang {
  try {
    const nav = typeof navigator !== 'undefined' ? navigator.language : '';
    return nav.toLowerCase().startsWith('ko') ? 'ko' : 'en';
  } catch {
    return 'en';
  }
}

export function defaultSave(): SaveData {
  return {
    version: 2,
    best: 0,
    level: 1,
    runs: 0,
    settings: { sfx: true, bgm: true, lang: defaultLang() },
  };
}

function cleanNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** Parses a save file, tolerating missing, damaged or older fields. */
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
    version: 2,
    best: cleanNumber(obj.best),
    level: Math.max(1, cleanNumber(obj.level) || 1),
    runs: cleanNumber(obj.runs),
    settings: {
      sfx: typeof settings.sfx === 'boolean' ? settings.sfx : base.settings.sfx,
      bgm: typeof settings.bgm === 'boolean' ? settings.bgm : base.settings.bgm,
      lang,
    },
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

/** Records a finished run: best score and the furthest stage reached. */
export function recordRun(save: SaveData, score: number, level: number): SaveData {
  return {
    ...save,
    best: Math.max(save.best, Math.floor(score)),
    level: Math.max(save.level, Math.floor(level)),
    runs: save.runs + 1,
  };
}

/** Saves progress in the middle of a run (leaving the tab, pausing). */
export function rememberLevel(save: SaveData, score: number, level: number): SaveData {
  return {
    ...save,
    best: Math.max(save.best, Math.floor(score)),
    level: Math.max(save.level, Math.floor(level)),
  };
}
