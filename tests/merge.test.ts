import { describe, expect, it } from 'vitest';
import { mergeRule, nextEvolution } from '../src/core/merge';
import {
  ABSORB_BONUS,
  KOMI_LINE,
  LEGENDARY,
  MOMO_LINE,
  TROPHY_GOLD,
  TROPHY_HANBOK,
  ALL_DEFS,
  COLLECTION_ORDER,
  defById,
} from '../src/core/config';

describe('merge rules', () => {
  it('evolves paw + paw into MOMO BASIC', () => {
    const rule = mergeRule(MOMO_LINE[0], MOMO_LINE[0]);
    expect(rule?.kind).toBe('evolve');
    expect(rule?.into?.id).toBe('momo-2');
  });

  it('evolves flower + flower into KOMI BASIC', () => {
    const rule = mergeRule(KOMI_LINE[0], KOMI_LINE[0]);
    expect(rule?.kind).toBe('evolve');
    expect(rule?.into?.id).toBe('komi-2');
  });

  it('walks both lines through all four levels', () => {
    for (const line of [MOMO_LINE, KOMI_LINE]) {
      expect(mergeRule(line[0], line[0])?.into?.id).toBe(line[1].id);
      expect(mergeRule(line[1], line[1])?.into?.id).toBe(line[2].id);
      expect(mergeRule(line[2], line[2])?.into?.id).toBe(line[3].id);
    }
  });

  it('absorbs two ROYAL bubbles of the same line with a bonus', () => {
    for (const line of [MOMO_LINE, KOMI_LINE]) {
      const rule = mergeRule(line[3], line[3]);
      expect(rule?.kind).toBe('absorb');
      expect(rule?.bonus).toBe(ABSORB_BONUS);
    }
  });

  it('never merges a paw into a flower or the two lines together', () => {
    expect(mergeRule(MOMO_LINE[0], KOMI_LINE[0])).toBeNull();
    expect(mergeRule(MOMO_LINE[1], KOMI_LINE[1])).toBeNull();
    expect(mergeRule(MOMO_LINE[2], KOMI_LINE[2])).toBeNull();
  });

  it('never merges different levels of the same line', () => {
    expect(mergeRule(MOMO_LINE[0], MOMO_LINE[1])).toBeNull();
    expect(mergeRule(KOMI_LINE[1], KOMI_LINE[2])).toBeNull();
  });

  it('fuses MOMO ROYAL with KOMI ROYAL into LEGENDARY', () => {
    const a = mergeRule(MOMO_LINE[3], KOMI_LINE[3]);
    const b = mergeRule(KOMI_LINE[3], MOMO_LINE[3]);
    expect(a?.kind).toBe('legend');
    expect(a?.into?.id).toBe(LEGENDARY.id);
    expect(b?.kind).toBe('legend');
    expect(b?.into?.id).toBe(LEGENDARY.id);
  });

  it('lets the LEGENDARY bubble absorb anything and never evolve further', () => {
    expect(mergeRule(LEGENDARY, MOMO_LINE[0])?.kind).toBe('absorb');
    expect(mergeRule(LEGENDARY, KOMI_LINE[2])?.kind).toBe('absorb');
    expect(mergeRule(LEGENDARY, LEGENDARY)?.kind).toBe('absorb');
    expect(mergeRule(LEGENDARY, MOMO_LINE[3])?.kind).toBe('absorb');
    expect(mergeRule(LEGENDARY, MOMO_LINE[0])?.into).toBeUndefined();
  });

  it('keeps the collection ids stable and complete', () => {
    expect(COLLECTION_ORDER).toHaveLength(11);
    expect(new Set(COLLECTION_ORDER).size).toBe(11);
    for (const id of COLLECTION_ORDER) expect(defById(id).id).toBe(id);
    expect(ALL_DEFS.length).toBe(11);
    expect(defById('komi-hanbok')).toBe(TROPHY_HANBOK);
    expect(defById('komi-gold')).toBe(TROPHY_GOLD);
  });

  it('reports the next evolution for the UI', () => {
    expect(nextEvolution(MOMO_LINE[0])?.id).toBe('momo-2');
    expect(nextEvolution(MOMO_LINE[3])).toBeNull();
    expect(nextEvolution(LEGENDARY)).toBeNull();
  });
});
