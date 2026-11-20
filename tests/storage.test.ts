import { describe, expect, it } from 'vitest';
import {
  SAVE_KEY,
  commitRun,
  defaultSave,
  loadSave,
  markSeen,
  parseSave,
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
    expect(save.best).toBe(0);
    expect(save.discovered).toEqual([]);
    expect(save.settings).toEqual({ sfx: true, bgm: true, lang: 'en' });
  });

  it('round-trips best score, collection and settings', () => {
    const store = memoryStore();
    const save = {
      ...defaultSave(),
      best: 4321,
      discovered: ['momo-1', 'momo-2', 'legend'],
      settings: { sfx: false, bgm: true, lang: 'ko' as const },
    };
    writeSave(store, save);
    const loaded = loadSave(store);
    expect(loaded.best).toBe(4321);
    expect(loaded.discovered).toEqual(['momo-1', 'momo-2', 'legend']);
    expect(loaded.settings).toEqual({ sfx: false, bgm: true, lang: 'ko' });
    expect(store.data[SAVE_KEY]).toContain('4321');
  });

  it('survives corrupt, partial and unknown data', () => {
    expect(parseSave('not json').best).toBe(0);
    expect(parseSave('{"best":"lots"').discovered).toEqual([]);
    const partial = parseSave(JSON.stringify({ best: 12, discovered: ['momo-1', 'nope', 'momo-1'] }));
    expect(partial.best).toBe(12);
    expect(partial.discovered).toEqual(['momo-1']);
    expect(partial.settings).toEqual({ sfx: true, bgm: true, lang: 'en' });
    const weird = parseSave(JSON.stringify({ best: -5, discovered: 'x', settings: { lang: 'fr' } }));
    expect(weird.best).toBe(0);
    expect(weird.discovered).toEqual([]);
    expect(weird.settings.lang).toBe('en');
  });

  it('ignores a store that throws (private mode)', () => {
    const throwing: Store = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadSave(throwing).best).toBe(0);
    expect(() => writeSave(throwing, defaultSave())).not.toThrow();
  });

  it('commits a run: best score, discoveries, run count and NEW badges', () => {
    let save = defaultSave();
    save = commitRun(save, 900, ['momo-1', 'komi-2']);
    expect(save.best).toBe(900);
    expect(save.runs).toBe(1);
    expect(save.discovered).toEqual(['momo-1', 'komi-2']);
    expect(save.unseen).toEqual(['momo-1', 'komi-2']);

    save = commitRun(save, 400, ['momo-2']);
    expect(save.best).toBe(900);
    expect(save.runs).toBe(2);
    expect(save.discovered).toEqual(['momo-1', 'momo-2', 'komi-2']);
    expect(save.unseen).toEqual(['momo-1', 'momo-2', 'komi-2']);

    save = markSeen(save);
    expect(save.unseen).toEqual([]);
    save = commitRun(save, 100, ['momo-1']);
    expect(save.unseen).toEqual([]);
  });

  it('keeps the collection ordered and deduplicated', () => {
    const save = commitRun(defaultSave(), 10, ['legend', 'momo-1', 'legend', 'komi-4', 'unknown']);
    expect(save.discovered).toEqual(['momo-1', 'komi-4', 'legend']);
  });
});
