import { describe, expect, it } from 'vitest';
import { BubbleMergeGame } from '../src/core/game';
import { KOMI_LINE, LEGENDARY, MOMO_LINE } from '../src/core/config';
import type { GameEvent } from '../src/core/types';

function newGame(seed = 7): BubbleMergeGame {
  const game = new BubbleMergeGame({ seed });
  game.start();
  game.drainEvents();
  return game;
}

function stepFor(game: BubbleMergeGame, seconds: number, stepMs = 16.6667): void {
  const steps = Math.max(1, Math.round((seconds * 1000) / stepMs));
  for (let i = 0; i < steps; i++) game.step(stepMs);
}

function eventsOfType<T extends GameEvent['type']>(events: GameEvent[], type: T): Extract<GameEvent, { type: T }>[] {
  return events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
}

describe('merge simulation', () => {
  it('merges paw + paw into MOMO BASIC and scores', () => {
    const game = newGame();
    game.place('momo-1', 360, 700);
    game.place('momo-1', 384, 700);
    game.step(16);
    const live = game.liveBubbles();
    expect(live).toHaveLength(1);
    expect(live[0].def.id).toBe('momo-2');
    expect(game.merges).toBe(1);
    expect(game.score).toBeGreaterThan(0);
  });

  it('merges flower + flower into KOMI BASIC', () => {
    const game = newGame();
    game.place('komi-1', 300, 700);
    game.place('komi-1', 330, 700);
    game.step(16);
    expect(game.liveBubbles()[0].def.id).toBe('komi-2');
  });

  it('keeps paw and flower apart (physics only, no merge)', () => {
    const game = newGame();
    game.place('momo-1', 360, 700);
    game.place('komi-1', 388, 700);
    game.drainEvents();
    stepFor(game, 1.2);
    expect(eventsOfType(game.drainEvents(), 'merge')).toHaveLength(0);
    expect(game.liveBubbles()).toHaveLength(2);
    expect(game.score).toBe(0);
  });

  it('merges bubbles that are only touching (no visible overlap)', () => {
    const game = newGame();
    game.place('momo-1', 300, 700);
    game.place('momo-1', 300 + 68, 700);
    game.step(16);
    expect(game.liveBubbles()).toHaveLength(1);
    expect(game.liveBubbles()[0].def.id).toBe('momo-2');
  });

  it('merges a bubble that falls onto its twin', () => {
    const game = newGame(21);
    game.place('komi-1', 360, 1200);
    stepFor(game, 0.6);
    const falling = game.place('komi-1', 360, 700, 320);
    expect(falling.alive).toBe(true);
    stepFor(game, 1.2);
    expect(game.merges).toBeGreaterThanOrEqual(1);
    expect(game.liveBubbles().some((b) => b.def.id === 'komi-2')).toBe(true);
  });

  it('does not merge different levels of the same line', () => {
    const game = newGame();
    game.place('momo-1', 360, 700);
    game.place('momo-2', 380, 700);
    stepFor(game, 0.5);
    expect(game.liveBubbles()).toHaveLength(2);
    expect(game.merges).toBe(0);
  });

  it('never lets one bubble be counted in two merges at once', () => {
    const game = newGame();
    game.place('momo-1', 360, 700);
    game.place('momo-1', 366, 700);
    game.place('momo-1', 372, 700);
    game.step(16);
    expect(game.merges).toBe(1);
    const ids = game.liveBubbles().map((b) => b.def.id).sort();
    expect(ids).toEqual(['momo-1', 'momo-2']);
  });

  it('walks the full MOMO line: 1+1 -> 2, 2+2 -> 3, 3+3 -> ROYAL', () => {
    const game = newGame();
    game.place('momo-1', 360, 700);
    game.place('momo-1', 384, 700);
    game.step(16);
    expect(game.liveBubbles()[0].def.id).toBe('momo-2');

    game.place('momo-2', 500, 700);
    game.place('momo-2', 520, 700);
    game.step(16);
    expect(game.liveBubbles().some((b) => b.def.id === 'momo-3')).toBe(true);

    game.place('momo-3', 200, 400);
    game.place('momo-3', 240, 400);
    game.step(16);
    expect(game.liveBubbles().some((b) => b.def.id === 'momo-4')).toBe(true);
  });

  it('walks the full KOMI line', () => {
    const game = newGame();
    game.place('komi-1', 360, 700);
    game.place('komi-1', 384, 700);
    game.step(16);
    game.place('komi-2', 500, 700);
    game.place('komi-2', 520, 700);
    game.step(16);
    game.place('komi-3', 200, 400);
    game.place('komi-3', 240, 400);
    game.step(16);
    expect(game.liveBubbles().some((b) => b.def.id === 'komi-4')).toBe(true);
  });

  it('turns two ROYAL bubbles of one line into one ROYAL plus a bonus', () => {
    const game = newGame();
    game.place('momo-4', 360, 700);
    game.place('momo-4', 380, 700);
    stepFor(game, 0.2);
    const royals = game.liveBubbles().filter((b) => b.def.id === 'momo-4');
    expect(royals).toHaveLength(1);
    expect(game.absorbed).toBe(1);
    expect(game.score).toBeGreaterThanOrEqual(50);
  });

  it('fuses MOMO ROYAL + KOMI ROYAL into the LEGENDARY bubble with slow motion', () => {
    const game = newGame();
    game.place(MOMO_LINE[3].id, 360, 700);
    game.place(KOMI_LINE[3].id, 380, 700);
    game.step(16);
    const live = game.liveBubbles();
    expect(live).toHaveLength(1);
    expect(live[0].def.id).toBe(LEGENDARY.id);
    expect(game.legendaries).toBe(1);
    expect(game.slowMo).toBeGreaterThan(0);
    expect(game.score).toBeGreaterThanOrEqual(LEGENDARY.score);
    const events = game.drainEvents();
    expect(eventsOfType(events, 'legendary')).toHaveLength(1);
    expect(game.discovered.has('komi-gold')).toBe(true);
  });

  it('lets the LEGENDARY bubble absorb a smaller bubble', () => {
    const game = newGame();
    game.place(LEGENDARY.id, 360, 700);
    const small = game.place('momo-1', 380, 700);
    expect(small.alive).toBe(true);
    game.step(16);
    const live = game.liveBubbles();
    expect(live).toHaveLength(1);
    expect(live[0].def.id).toBe(LEGENDARY.id);
    expect(game.score).toBeGreaterThan(0);
  });

  it('awards combo multipliers for merges inside the combo window', () => {
    const game = newGame();
    game.place('momo-1', 200, 700);
    game.place('momo-1', 220, 700);
    game.step(16);
    const firstScore = game.score;
    game.place('komi-1', 500, 700);
    game.place('komi-1', 520, 700);
    game.step(16);
    expect(game.combo).toBe(2);
    expect(game.score - firstScore).toBeGreaterThan(firstScore);
  });

  it('resets the combo after the window passes', () => {
    const game = newGame();
    game.place('momo-1', 200, 700);
    game.place('momo-1', 220, 700);
    game.step(16);
    expect(game.combo).toBe(1);
    stepFor(game, 2);
    expect(game.combo).toBe(0);
  });
});

describe('run flow', () => {
  it('drops the held bubble and enforces the drop cooldown', () => {
    const game = newGame();
    const held = game.current;
    expect(held).not.toBeNull();
    expect(game.drop()).toBe(true);
    expect(game.drop()).toBe(false);
    expect(game.heldX()).toBeGreaterThanOrEqual(0);
    stepFor(game, 0.5);
    expect(game.drop()).toBe(true);
  });

  it('keeps the held bubble inside the walls', () => {
    const game = newGame();
    game.setPointer(-500);
    expect(game.heldX()).toBeGreaterThan(0);
    game.setPointer(5000);
    expect(game.heldX()).toBeLessThan(720);
  });

  it('ends the run when bubbles stay above the line', () => {
    const game = newGame(11);
    const cycle = ['momo-4', 'komi-3', 'momo-2', 'komi-1'];
    for (let i = 0; i < 90; i++) {
      const bubble = game.place(cycle[i % cycle.length], 90 + ((i * 97) % 540), 1230);
      bubble.mergeReadyAt = Number.POSITIVE_INFINITY;
      game.step(40);
    }
    expect(game.dangerRatio()).toBeGreaterThan(0);
    stepFor(game, 2.6);
    expect(game.state).toBe('over');
    const events = game.drainEvents();
    expect(eventsOfType(events, 'gameover')).toHaveLength(1);
  });

  it('never lets a bubble escape the field during play', () => {
    const game = newGame(3);
    for (let i = 0; i < 25; i++) {
      game.setPointer(80 + ((i * 131) % 560));
      game.drop();
      stepFor(game, 0.4);
      for (const b of game.liveBubbles()) {
        expect(b.x - b.r).toBeGreaterThanOrEqual(-0.6);
        expect(b.x + b.r).toBeLessThanOrEqual(720.6);
        expect(b.y - b.r).toBeGreaterThanOrEqual(-0.6);
        expect(b.y + b.r).toBeLessThanOrEqual(1280.6);
      }
    }
  });

  it('restarting clears the board and the score but keeps discoveries', () => {
    const game = newGame();
    game.place('komi-3', 360, 700);
    expect(game.discovered.has('komi-3')).toBe(true);
    game.gameOver();
    game.start();
    expect(game.state).toBe('playing');
    expect(game.score).toBe(0);
    expect(game.liveBubbles()).toHaveLength(0);
    expect(game.discovered.has('komi-3')).toBe(true);
  });

  it('tracks and keeps the best score', () => {
    const game = newGame();
    game.place('komi-4', 360, 700);
    game.place('momo-4', 380, 700);
    game.step(16);
    const scored = game.score;
    expect(scored).toBeGreaterThan(0);
    game.gameOver();
    expect(game.best).toBe(scored);
    expect(game.state).toBe('over');
  });

  it('pauses and resumes without advancing the simulation', () => {
    const game = newGame();
    game.drop();
    game.pause();
    const before = game.liveBubbles()[0]?.y ?? 0;
    stepFor(game, 0.5);
    expect(game.liveBubbles()[0]?.y ?? 0).toBeCloseTo(before, 5);
    game.resume();
    stepFor(game, 0.5);
    expect(game.state).toBe('playing');
  });

  it('unlocks the hanbok trophy at 2,000 points and the golden komi with a legendary', () => {
    const game = newGame();
    game.score = 2000;
    game.step(16);
    expect(game.discovered.has('komi-hanbok')).toBe(true);

    const game2 = newGame();
    game2.place('momo-4', 360, 700);
    game2.place('komi-4', 380, 700);
    game2.step(16);
    expect(game2.discovered.has('komi-gold')).toBe(true);
  });

  it('emits a discovery event only once per bubble', () => {
    const game = newGame();
    game.drainEvents();
    game.place('komi-3', 300, 700);
    game.place('komi-3', 300, 300);
    game.step(16);
    const events = game.drainEvents();
    const discoveries = eventsOfType(events, 'discover');
    expect(discoveries).toHaveLength(1);
    expect(discoveries[0].id).toBe('komi-3');
  });
});
