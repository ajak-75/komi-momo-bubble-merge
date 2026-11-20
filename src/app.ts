import { MAX_AIM_ANGLE } from './core/aim';
import { AudioEngine } from './audio';
import { COLOR_ORDER } from './core/config';
import { BubbleShooter } from './core/game';
import { createRng } from './core/rng';
import { SAVE_KEY, loadSave, recordRun, rememberLevel, writeSave, type SaveData } from './core/storage';
import type { Lang } from './core/types';
import { applyStaticText, t } from './i18n';
import { Renderer } from './render';

type Screen = 'menu' | 'game' | 'pause' | 'over' | 'clear';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

const num = (value: number): string => Math.floor(value).toLocaleString();

export async function bootstrap(): Promise<void> {
  const canvas = $<HTMLCanvasElement>('gameCanvas');
  const renderer = new Renderer(canvas);
  await renderer.load();

  const audio = new AudioEngine();
  let save: SaveData = loadSave(localStorage);
  let lang: Lang = save.settings.lang;
  audio.sfxEnabled = save.settings.sfx;
  audio.bgmEnabled = save.settings.bgm;

  const game = new BubbleShooter(createRng((Date.now() ^ 0x5eed) >>> 0), renderer.worldHeight);
  game.setHeight(renderer.resize());

  let screen: Screen = 'menu';
  let paused = false;
  let aiming = false;

  /* --------------------------------------------------------------- screens */

  const menuEl = $('screenMenu');
  const pauseEl = $('screenPause');
  const overEl = $('screenOver');
  const clearEl = $('screenClear');
  const toastEl = $('toast');

  function hideAll(): void {
    menuEl.hidden = true;
    pauseEl.hidden = true;
    overEl.hidden = true;
    clearEl.hidden = true;
  }

  function persist(): void {
    writeSave(localStorage, save);
  }

  function syncHud(): void {
    $('scoreValue').textContent = num(game.score);
    $('stageValue').textContent = String(game.level);
    $('hudBest').textContent = num(Math.max(save.best, game.score));
    const every = Math.max(1, game.cfg.dropEvery);
    const left = Math.max(0, game.shotsUntilRow);
    $('rowFill').style.width = `${Math.round(((every - left) / every) * 100)}%`;
    $<HTMLButtonElement>('btnPause').disabled = screen !== 'game';
  }

  function syncSoundUi(): void {
    $('soundIco').textContent = audio.sfxEnabled ? '♪' : '×';
    $('soundLabel').textContent = t(lang, audio.sfxEnabled ? 'sfxOn' : 'sfxOff');
    for (const id of ['btnSfx', 'btnSfxPause']) {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('off', !audio.sfxEnabled);
    }
    for (const id of ['btnBgm', 'btnBgmPause']) {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('off', !audio.bgmEnabled);
    }
  }

  function applyLang(): void {
    document.documentElement.lang = lang;
    applyStaticText(document, lang);
    $('btnLang').textContent = lang === 'ko' ? 'EN' : 'KO';
    $('btnLangPause').textContent = lang === 'ko' ? 'EN' : 'KO';
    document.title = `KOMI & MOMO ${t(lang, 'title')}`;
    syncSoundUi();
    renderMenuStats();
  }

  function renderMenuStats(): void {
    $('menuBest').textContent = num(save.best);
    const cont = $<HTMLButtonElement>('btnContinue');
    cont.hidden = save.level <= 1;
    $('continueStage').textContent = `${t(lang, 'stage')} ${save.level}`;
  }

  function setLang(next: Lang): void {
    lang = next;
    save = { ...save, settings: { ...save.settings, lang } };
    persist();
    applyLang();
  }

  function showMenu(): void {
    screen = 'menu';
    paused = true;
    hideAll();
    menuEl.hidden = false;
    syncHud();
    renderMenuStats();
  }

  function startGame(stage: number, score = 0): void {
    audio.unlock();
    game.startLevel(stage);
    game.score = score;
    screen = 'game';
    paused = false;
    hideAll();
    syncHud();
    if (save.runs === 0) showToast(t(lang, 'tapHint'), 2600);
  }

  function showPause(): void {
    if (screen !== 'game') return;
    screen = 'pause';
    paused = true;
    pauseEl.hidden = false;
    save = rememberLevel(save, game.score, game.level);
    persist();
    syncHud();
  }

  function resume(): void {
    if (screen !== 'pause') return;
    pauseEl.hidden = true;
    screen = 'game';
    paused = false;
    syncHud();
  }

  function showOver(): void {
    screen = 'over';
    paused = true;
    const isRecord = game.score > save.best;
    save = recordRun(save, game.score, game.level);
    persist();
    $('finalScore').textContent = num(game.score);
    $('finalStage').textContent = String(game.level);
    $('recordBadge').hidden = !isRecord;
    hideAll();
    overEl.hidden = false;
    syncHud();
  }

  function showClear(bonus: number): void {
    screen = 'clear';
    paused = true;
    save = rememberLevel(save, game.score, game.level + 1);
    persist();
    $('clearScore').textContent = num(game.score);
    $('clearBonus').textContent = `+${num(bonus)}`;
    hideAll();
    clearEl.hidden = false;
    syncHud();
  }

  let toastTimer = 0;
  function showToast(text: string, ms = 1800): void {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), ms);
  }

  /* ---------------------------------------------------------------- events */

  function handleEvents(): void {
    for (const ev of game.takeEvents()) {
      switch (ev.type) {
        case 'shoot':
          audio.playShoot();
          break;
        case 'wall':
          audio.playBounce();
          break;
        case 'pop': {
          for (const cell of ev.cells) {
            const c = game.centerOf(cell.row, cell.col);
            renderer.burst(c.x, c.y, tintColor(ev.color), 8, 0.9);
          }
          renderer.burst(ev.at.x, ev.at.y, '#ffe9c4', 12, 1.05);
          renderer.popup(ev.at.x, ev.at.y - 8, `+${ev.points}`, '#ffe6a8', 34 + Math.min(16, ev.cells.length * 2));
          if (ev.combo >= 2) {
            renderer.popup(ev.at.x, ev.at.y + 42, `${t(lang, 'combo')} x${ev.combo}`, '#9bf0ff', 26);
          }
          renderer.shake(3 + ev.cells.length * 0.8);
          audio.playPop(ev.combo, ev.cells.length);
          break;
        }
        case 'drop':
          renderer.popup(ev.at.x, ev.at.y, `+${ev.points}`, '#c8ffb0', 30);
          audio.playDrop(ev.count);
          break;
        case 'row':
          renderer.shake(11);
          renderer.flashScreen(0.16);
          audio.playRow();
          break;
        case 'miss':
          break;
        case 'clear':
          audio.playClear();
          renderer.flashScreen(0.4);
          for (let i = 0; i < 14; i++) {
            renderer.burst(90 + Math.random() * 540, 160 + Math.random() * 420, tintColor(COLOR_ORDER[i % 6]), 6, 1.1);
          }
          showClear(ev.bonus);
          break;
        case 'over':
          audio.playGameOver();
          showOver();
          break;
        case 'swap':
          audio.playUi();
          break;
      }
    }
    syncHud();
  }

  /* ----------------------------------------------------------------- input */

  function aimAt(clientX: number, clientY: number): void {
    const p = renderer.toWorld(clientX, clientY);
    const dx = p.x - game.launcherX;
    const dy = game.launcherY - p.y;
    if (dy < 24) {
      game.setAngle((dx >= 0 ? 1 : -1) * MAX_AIM_ANGLE * 0.9);
      return;
    }
    game.setAngle(Math.atan2(dx, dy));
  }

  function inSwapZone(clientX: number, clientY: number): boolean {
    const p = renderer.toWorld(clientX, clientY);
    const badge = { x: game.nextX - 76, y: game.launcherY };
    if (Math.hypot(p.x - badge.x, p.y - badge.y) < 46) return true;
    if (Math.hypot(p.x - game.nextX, p.y - game.launcherY) < 52) return true;
    return false;
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (screen !== 'game' || paused) return;
    audio.unlock();
    if (game.phase !== 'ready') return;
    if (inSwapZone(e.clientX, e.clientY)) {
      game.swap();
      handleEvents();
      return;
    }
    aiming = true;
    canvas.setPointerCapture(e.pointerId);
    aimAt(e.clientX, e.clientY);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!aiming) return;
    aimAt(e.clientX, e.clientY);
  });

  const endAim = (e: PointerEvent): void => {
    if (!aiming) return;
    aiming = false;
    aimAt(e.clientX, e.clientY);
    if (game.phase === 'ready') game.fire();
  };
  canvas.addEventListener('pointerup', endAim);
  canvas.addEventListener('pointercancel', () => {
    aiming = false;
  });

  window.addEventListener('keydown', (e) => {
    if (screen === 'game' && !paused) {
      if (e.key === 'ArrowLeft') {
        game.setAngle(game.angle - 0.04);
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        game.setAngle(game.angle + 0.04);
        e.preventDefault();
      } else if (e.key === ' ' || e.key === 'Enter') {
        game.fire();
        e.preventDefault();
      } else if (e.key === 's' || e.key === 'S') {
        game.swap();
      }
    }
    if (e.key === 'Escape') {
      if (screen === 'game') showPause();
      else if (screen === 'pause') resume();
    }
  });

  /* ---------------------------------------------------------------- wiring */

  $('btnPlay').addEventListener('click', () => startGame(1));
  $('btnContinue').addEventListener('click', () => startGame(save.level));
  $('btnPause').addEventListener('click', () => showPause());
  $('btnResume').addEventListener('click', () => resume());
  $('btnPauseRestart').addEventListener('click', () => startGame(1));
  $('btnPauseMenu').addEventListener('click', () => showMenu());
  $('btnRestart').addEventListener('click', () => startGame(1));
  $('btnOverMenu').addEventListener('click', () => showMenu());
  $('btnNextStage').addEventListener('click', () => {
    game.nextLevel();
    screen = 'game';
    paused = false;
    hideAll();
    syncHud();
  });
  $('btnClearMenu').addEventListener('click', () => showMenu());

  $('btnSfx').addEventListener('click', (e) => {
    e.stopPropagation();
    save = { ...save, settings: { ...save.settings, sfx: !audio.sfxEnabled } };
    audio.setSfx(!audio.sfxEnabled);
    persist();
    syncSoundUi();
  });
  $('btnBgm').addEventListener('click', (e) => {
    e.stopPropagation();
    save = { ...save, settings: { ...save.settings, bgm: !audio.bgmEnabled } };
    audio.setBgm(!audio.bgmEnabled);
    persist();
    syncSoundUi();
  });
  $('btnSound').addEventListener('click', () => {
    const on = !(audio.sfxEnabled || audio.bgmEnabled);
    audio.setSfx(on);
    audio.setBgm(on);
    save = { ...save, settings: { ...save.settings, sfx: on, bgm: on } };
    persist();
    syncSoundUi();
  });
  $('btnSfxPause').addEventListener('click', () => {
    save = { ...save, settings: { ...save.settings, sfx: !audio.sfxEnabled } };
    audio.setSfx(!audio.sfxEnabled);
    persist();
    syncSoundUi();
  });
  $('btnBgmPause').addEventListener('click', () => {
    save = { ...save, settings: { ...save.settings, bgm: !audio.bgmEnabled } };
    audio.setBgm(!audio.bgmEnabled);
    persist();
    syncSoundUi();
  });
  $('btnLang').addEventListener('click', () => setLang(lang === 'ko' ? 'en' : 'ko'));
  $('btnLangPause').addEventListener('click', () => setLang(lang === 'ko' ? 'en' : 'ko'));

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'game') showPause();
  });

  // Menu bubble strip
  const strip = $('bubbleStrip');
  for (const id of COLOR_ORDER) {
    const dot = document.createElement('span');
    dot.className = 'bubble-dot';
    dot.style.backgroundImage = `url("${spriteFor(id)}")`;
    strip.appendChild(dot);
  }

  // Keep the board the same shape as the device leaves for it.
  const field = $('field');
  const onResize = (): void => {
    game.setHeight(renderer.resize());
  };
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(onResize).observe(field);
  }
  window.addEventListener('orientationchange', () => window.setTimeout(onResize, 120));
  window.addEventListener('resize', onResize);
  onResize();

  applyLang();
  showMenu();
  syncHud();

  /* ----------------------------------------------------------------- loop */

  let last = performance.now();
  const frame = (now: number): void => {
    const dt = (now - last) / 1000;
    last = now;
    if (screen === 'game' && !paused) {
      game.update(dt);
      handleEvents();
    }
    renderer.render(game, dt, lang);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // Leaving the page mid-run keeps the stage the player reached.
  window.addEventListener('pagehide', () => {
    if (screen === 'game' || screen === 'pause') {
      save = rememberLevel(save, game.score, game.level);
    }
    persist();
  });
  if (typeof (window as unknown as { __kmb?: unknown }).__kmb === 'undefined') {
    (window as unknown as { __kmb?: unknown }).__kmb = { game, save: () => save, key: SAVE_KEY };
  }
}

function spriteFor(id: string): string {
  return `./assets/bubbles/${id}.webp`;
}

function tintColor(id: string): string {
  switch (id) {
    case 'violet':
      return '#8d5bff';
    case 'red':
      return '#ff5d6c';
    case 'mint':
      return '#62ecc4';
    case 'pink':
      return '#ff74b8';
    case 'sky':
      return '#6ad4ff';
    default:
      return '#ffcf5c';
  }
}
