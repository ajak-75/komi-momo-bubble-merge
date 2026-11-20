import { describe, expect, it } from 'vitest';
import { BubbleShooter } from '../src/core/game';
import type { GameEvent } from '../src/core/game';
import { CLEAR_BONUS, DROP_POINTS, POP_BASE, levelConfig } from '../src/core/config';
import { createRng } from '../src/core/rng';
import { colsInRow } from '../src/core/hex';
import type { ColorId } from '../src/core/types';

function newGame(seed = 7): BubbleShooter {
  const game = new BubbleShooter(createRng(seed));
  game.takeEvents();
  return game;
}

/** Runs the simulation until the shot has landed (or the phase is no longer flying). */
function fly(game: BubbleShooter, seconds = 2): void {
  const step = 1 / 60;
  for (let t = 0; t < seconds; t += step) {
    game.update(step);
    if (!game.flying && game.phase !== 'flying') return;
  }
}

function types(events: GameEvent[]): string[] {
  return events.map((e) => e.type);
}

describe('bubble shooter', () => {
  it('deals a starting board with no ready-made cluster', () => {
    const game = newGame();
    expect(game.count).toBe(8 + 7 + 8);
    const view = game.bubbles();
    for (const b of view) {
      const same = view.filter(
        (o) =>
          o.color === b.color &&
          Math.hypot(
            game.centerOf(o.row, o.col).x - game.centerOf(b.row, b.col).x,
            game.centerOf(o.row, o.col).y - game.centerOf(b.row, b.col).y,
          ) <= 90.5,
      );
      expect(same.length).toBeLessThanOrEqual(2);
    }
  });

  it('hands the cannon only colours that are still on the board', () => {
    const game = newGame();
    const loadBoard = game.loadBoard.bind(game);
    loadBoard([{ row: 0, col: 0, color: 'mint' }]);
    expect(game.current).toBe('mint');
    expect(game.next).toBe('mint');
  });

  it('previews the landing cell and lands the shot there', () => {
    const game = newGame();
    game.loadBoard([
      { row: 0, col: 0, color: 'mint' },
      { row: 2, col: 3, color: 'red' },
      { row: 2, col: 4, color: 'red' },
    ], { current: 'sky', next: 'sky' });
    game.setAngle(0);
    const preview = game.aim();
    expect(preview.cell).toEqual({ row: 3, col: 3 });

    game.fire();
    expect(game.phase).toBe('flying');
    fly(game);
    expect(game.phase).not.toBe('flying');
    expect(game.bubbleAt(3, 3)?.color).toBe('sky');
  });

  it('pops three connected bubbles and scores', () => {
    const game = newGame();
    game.loadBoard([
      { row: 0, col: 0, color: 'mint' },
      { row: 2, col: 3, color: 'red' },
      { row: 2, col: 4, color: 'red' },
    ], { current: 'red' });
    game.fire();
    fly(game);
    expect(game.bubbleAt(2, 3)).toBeUndefined();
    expect(game.bubbleAt(2, 4)).toBeUndefined();
    expect(game.bubbleAt(3, 3)).toBeUndefined();
    expect(game.score).toBe(POP_BASE * 3);
    expect(game.combo).toBe(1);
    expect(types(game.takeEvents())).toContain('pop');
  });

  it('drops bubbles that lost their hold on the ceiling for a bonus', () => {
    const game = newGame();
    game.loadBoard([
      { row: 0, col: 0, color: 'mint' },
      { row: 2, col: 3, color: 'red' },
      { row: 2, col: 4, color: 'red' },
      { row: 6, col: 0, color: 'sky' },
      { row: 6, col: 1, color: 'sky' },
    ], { current: 'red' });
    game.fire();
    fly(game);
    expect(game.bubbleAt(6, 0)).toBeUndefined();
    expect(game.bubbleAt(6, 1)).toBeUndefined();
    expect(game.score).toBe(POP_BASE * 3 + DROP_POINTS * 2);
    const events = game.takeEvents();
    const drop = events.find((e) => e.type === 'drop');
    expect(drop).toMatchObject({ type: 'drop', count: 2 });
  });

  it('keeps a solo shot on the board and counts a miss', () => {
    const game = newGame();
    game.loadBoard([
      { row: 0, col: 0, color: 'mint' },
      { row: 2, col: 3, color: 'red' },
    ], { current: 'violet' });
    game.fire();
    fly(game);
    expect(game.count).toBe(3);
    expect(game.combo).toBe(0);
    expect(types(game.takeEvents())).toContain('miss');
  });

  it('clears the stage and pays a bonus when the board empties', () => {
    const game = newGame();
    game.loadBoard([
      { row: 2, col: 3, color: 'red' },
      { row: 2, col: 4, color: 'red' },
    ], { current: 'red' });
    game.fire();
    fly(game);
    expect(game.count).toBe(0);
    expect(game.phase).toBe('cleared');
    expect(game.score).toBe(POP_BASE * 3 + CLEAR_BONUS);
    expect(game.takeEvents().find((e) => e.type === 'clear')).toMatchObject({ level: 1, bonus: CLEAR_BONUS });
  });

  it('swaps the loaded bubble with the next one', () => {
    const game = newGame();
    game.loadBoard([{ row: 0, col: 0, color: 'mint' }], { current: 'red', next: 'sky' });
    game.swap();
    expect(game.current).toBe('sky');
    expect(game.next).toBe('red');
    expect(types(game.takeEvents())).toContain('swap');
  });

  it('ignores the trigger while a shot is in the air', () => {
    const game = newGame();
    game.fire();
    game.fire();
    expect(game.shots).toBe(1);
  });

  it('pushes a fresh row down from the ceiling', () => {
    const game = newGame();
    game.loadBoard([{ row: 0, col: 0, color: 'mint' }]);
    const before = game.count;
    game.dropRow();
    expect(game.topRow).toBe(-1);
    expect(game.count).toBe(before + colsInRow(-1));
    expect(game.shotsUntilRow).toBe(game.cfg.dropEvery);
    expect(types(game.takeEvents())).toContain('row');
  });

  it('ends the run when a bubble crosses the danger line', () => {
    const game = newGame();
    game.setHeight(900);
    game.loadBoard([{ row: 8, col: 0, color: 'mint' }]);
    expect(game.overLine()).toBe(true);
    expect(game.pressure()).toBe(1);
    game.fire();
    fly(game);
    expect(game.phase).toBe('over');
    expect(types(game.takeEvents())).toContain('over');
  });

  it('raises the pressure as the lowest bubble nears the line', () => {
    const game = newGame();
    game.loadBoard([{ row: 0, col: 0, color: 'mint' }]);
    expect(game.pressure()).toBe(0);
  });

  it('widens the level curve with the stage', () => {
    expect(levelConfig(1)).toMatchObject({ rows: 3, dropEvery: 9 });
    expect(levelConfig(1).colors).toHaveLength(4);
    expect(levelConfig(5).rows).toBe(5);
    expect(levelConfig(7).colors.length).toBeGreaterThan(levelConfig(1).colors.length);
    expect(levelConfig(99).rows).toBeLessThanOrEqual(12);
    expect(levelConfig(99).dropEvery).toBeGreaterThanOrEqual(5);
  });

  it('starts the next stage one level up', () => {
    const game = newGame();
    game.startLevel(3);
    expect(game.level).toBe(3);
    game.nextLevel();
    expect(game.level).toBe(4);
    expect(game.count).toBe(game.bubbles().length);
    expect(new Set<ColorId>(game.bubbles().map((b) => b.color)).size).toBeLessThanOrEqual(levelConfig(4).colors.length);
  });
});
