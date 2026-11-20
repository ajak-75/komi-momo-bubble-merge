/** Deterministic RNG so tests and replays behave identically. */

export interface Rng {
  next(): number;
  int(maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
}

/** mulberry32 — small, fast, good enough for a casual game. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (maxExclusive: number) => Math.floor(next() * maxExclusive) % Math.max(1, maxExclusive),
    pick: <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length) % items.length],
  };
}
