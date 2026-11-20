import { describe, expect, it } from 'vitest';
import {
  SAVE_KEY,
  defaultSave,
  loadSave,
  parseSave,
  recordRun,
  rememberLevel,
  writeSave,
} from '../src/core/storage';
import type { Store } from '../src/core/storage';

function memoryStore(initial: Record<string, string> = {}): Store & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

describe('save file', () => {
  it('starts from defaults when nothing is stored', () => {
    const save = loadSave(memoryStore());
    expect(save.version).toBe(2);
    expect(save.best).toBe(0);
    expect(save.level).toBe(1);
    expect(save.runs).toBe(0);
    expect(save.settings).toMatchObject({ sfx: true, bgm: true });
  });

  it('round-trips score, stage and settings', () => {
    const store = memoryStore();
    const save = {
      ...defaultSave(),
      best: 4321,
      level: 7,
      runs: 12,
      settings: { sfx: false, bgm: true, lang: 'ko' as const },
    };
    writeSave(store, save);
    expect(store.data[SAVE_KEY]).toBeTruthy();
    expect(loadSave(store)).toEqual(save);
  });

  it('survives broken json and damaged fields', () => {
    expect(parseSave('not json')).toEqual(defaultSave());
    expect(parseSave('null')).toEqual(defaultSave());
    const repaired = parseSave(
      JSON.stringify({ best: -5, level: 0, runs: 'lots', settings: { sfx: 'yes', bgm: false, lang: 'fr' } }),
    );
    expect(repaired.best).toBe(0);
    expect(repaired.level).toBe(1);
    expect(repaired.runs).toBe(0);
    expect(repaired.settings.bgm).toBe(false);
    expect(['en', 'ko']).toContain(repaired.settings.lang);
  });

  it('survives a store that throws', () => {
    const store: Store = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(loadSave(store)).toEqual(defaultSave());
    expect(() => writeSave(store, defaultSave())).not.toThrow();
  });

  it('records a finished run', () => {
    const save = recordRun({ ...defaultSave(), best: 900, level: 3, runs: 2 }, 1200.7, 4);
    expect(save.best).toBe(1200);
    expect(save.level).toBe(4);
    expect(save.runs).toBe(3);
  });

  it('never lowers the best score or stage mid-run', () => {
    const save = rememberLevel({ ...defaultSave(), best: 900, level: 5, runs: 3 }, 400, 2);
    expect(save.best).toBe(900);
    expect(save.level).toBe(5);
    expect(save.runs).toBe(3);
  });
});
