import type { BubbleDef, MergeRule } from './types';
import { ABSORB_BONUS, KOMI_LINE, LEGENDARY, MOMO_LINE, lineOf } from './config';

const MAX_LEVEL = 4;

/**
 * The single source of truth for "may these two bubbles merge?".
 *
 *  - same line + same level (1..3)  -> evolve into the next level
 *  - same line + both ROYAL (4)     -> absorb: one bubble survives, bonus score
 *  - MOMO ROYAL + KOMI ROYAL        -> the legendary fusion
 *  - a LEGENDARY bubble touches any -> absorb + bonus, never evolves further
 *  - anything else (paw + flower, level 1 + level 2, …) -> plain physics only
 */
export function mergeRule(a: BubbleDef, b: BubbleDef): MergeRule | null {
  if (a.chain === 'legend' || b.chain === 'legend') {
    if (a.id === b.id && a.chain === 'legend' && b.chain === 'legend') {
      return { kind: 'absorb', bonus: LEGENDARY.score };
    }
    return { kind: 'absorb', bonus: ABSORB_BONUS };
  }

  if (a.chain !== b.chain) {
    const bothRoyal = a.level === MAX_LEVEL && b.level === MAX_LEVEL;
    if (bothRoyal) return { kind: 'legend', into: LEGENDARY, bonus: LEGENDARY.score };
    return null;
  }

  if (a.level !== b.level) return null;

  if (a.level >= MAX_LEVEL) {
    return { kind: 'absorb', bonus: ABSORB_BONUS };
  }

  const line = a.chain === 'momo' ? MOMO_LINE : KOMI_LINE;
  const next = line[a.level];
  if (!next) return null;
  return { kind: 'evolve', into: next };
}

/** Convenience for the UI/tests: the evolution target of one bubble, if any. */
export function nextEvolution(def: BubbleDef): BubbleDef | null {
  if (def.chain === 'legend') return null;
  if (def.level >= MAX_LEVEL) return null;
  return lineOf(def.chain as 'momo' | 'komi')[def.level] ?? null;
}
