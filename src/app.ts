import './styles.css';
import { BubbleMergeGame } from './core/game';
import { Renderer } from './render';
import { AudioEngine } from './audio';
import { applyStaticText, localized, t } from './i18n';
import type { StringKey } from './i18n';
import { ALL_DEFS, LEGENDARY, KOMI_LINE, MOMO_LINE, TROPHY_GOLD, TROPHY_HANBOK } from './core/config';
import { commitRun, defaultSave, loadSave, markSeen, mergeProgress, writeSave } from './core/storage';
import type { SaveData } from './core/storage';
import type { BubbleDef, GameEvent, Lang } from './core/types';

const spriteUrl = (sprite: string): string => `${import.meta.env.BASE_URL}assets/bubbles/${sprite}.webp`;

function q<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`missing element: ${selector}`);
  return el;
}

function loadImages(): Promise<Record<string, HTMLImageElement>> {
  const entries = ALL_DEFS.map((def) => def.sprite);
  const unique = Array.from(new Set(entries));
  return Promise.all(
    unique.map(
      (sprite) =>
        new Promise<[string, HTMLImageElement]>((resolve) => {
          const img = new Image();
          img.decoding = 'async';
          img.onload = () => resolve([sprite, img]);
          img.onerror = () => resolve([sprite, img]);
          img.src = spriteUrl(sprite);
        }),
    ),
  ).then((pairs) => Object.fromEntries(pairs));
}

export async function bootstrap(): Promise<void> {
  const board = q<HTMLDivElement>('#board');
  const canvas = q<HTMLCanvasElement>('#gameCanvas');
  const hud = q<HTMLElement>('#hud');
  const screenMenu = q<HTMLElement>('#screenMenu');
  const screenPause = q<HTMLElement>('#screenPause');
  const screenOver = q<HTMLElement>('#screenOver');
  const screenCollection = q<HTMLElement>('#screenCollection');
  const screenLegend = q<HTMLElement>('#screenLegend');

  const scoreValue = q<HTMLElement>('#scoreValue');
  const hudBest = q<HTMLElement>('#hudBest');
  const nextBubble = q<HTMLImageElement>('#nextBubble');
  const comboChip = q<HTMLElement>('#comboChip');
  const dangerBadge = q<HTMLElement>('#dangerBadge');
  const comboPop = q<HTMLElement>('#comboPop');
  const toast = q<HTMLElement>('#toast');
  const menuBest = q<HTMLElement>('#menuBest');
  const menuCount = q<HTMLElement>('#menuCollectionCount');
  const collectionGrid = q<HTMLElement>('#collectionGrid');
  const collectionSpecials = q<HTMLElement>('#collectionSpecials');
  const collectionProgress = q<HTMLElement>('#collectionProgress');
  const finalScore = q<HTMLElement>('#finalScore');
  const finalBest = q<HTMLElement>('#finalBest');
  const recordBadge = q<HTMLElement>('#recordBadge');
  const legendBonus = q<HTMLElement>('#legendBonus');
  const soundLabelMenu = q<HTMLElement>('#soundLabelMenu');
  const soundIcoMenu = q<HTMLElement>('#soundIcoMenu');
  const btnLang = q<HTMLButtonElement>('#btnLangMenu');
  const btnSoundMenu = q<HTMLButtonElement>('#btnSoundMenu');
  const btnSfx = q<HTMLButtonElement>('#btnSfx');
  const btnBgm = q<HTMLButtonElement>('#btnBgm');
  const btnSfxPause = q<HTMLButtonElement>('#btnSfxPause');
  const btnBgmPause = q<HTMLButtonElement>('#btnBgmPause');

  let store: Storage | null = null;
  try {
    store = window.localStorage;
    const probe = '__kmb_probe__';
    store.setItem(probe, '1');
    store.removeItem(probe);
  } catch {
    store = null;
  }

  let save: SaveData = store ? loadSave(store) : defaultSave();
  const persist = (): void => {
    if (store) writeSave(store, save);
  };

  const images = await loadImages();
  const audio = new AudioEngine();
  audio.setSfx(save.settings.sfx);
  audio.setBgm(save.settings.bgm);

  const game = new BubbleMergeGame({
    best: save.best,
    discovered: save.discovered,
  });
  const renderer = new Renderer(canvas, images);

  let lang: Lang = save.settings.lang;
  let dragging = false;
  let runCommitted = true;
  let legendTimer = 0;
  let toastTimer = 0;
  let lastScore = -1;

  /* --------------------------------------------------------------- language */

  const refreshText = (): void => {
    document.documentElement.lang = lang;
    applyStaticText(document, lang);
    btnLang.textContent = lang === 'en' ? 'EN' : 'KO';
    btnLang.setAttribute('aria-label', lang === 'en' ? 'Switch to Korean' : 'Switch to English');
    renderSoundLabels();
    renderCollection();
    refreshMenuStats();
    const tagline = document.querySelector<HTMLElement>('.tagline');
    if (tagline) tagline.textContent = t(lang, 'tagline' as StringKey);
  };

  const setLang = (next: Lang): void => {
    lang = next;
    save = { ...save, settings: { ...save.settings, lang: next } };
    persist();
    refreshText();
  };

  /* ------------------------------------------------------------------ sound */

  const renderSoundLabels = (): void => {
    const label = (on: boolean): string => (on ? 'ON' : 'OFF');
    btnSfx.textContent = `${t(lang, 'sfx')} ${label(save.settings.sfx)}`;
    btnBgm.textContent = `${t(lang, 'bgm')} ${label(save.settings.bgm)}`;
    btnSfxPause.textContent = `${t(lang, 'sfx')} ${label(save.settings.sfx)}`;
    btnBgmPause.textContent = `${t(lang, 'bgm')} ${label(save.settings.bgm)}`;
    btnSfx.classList.toggle('is-off', !save.settings.sfx);
    btnBgm.classList.toggle('is-off', !save.settings.bgm);
    btnSfxPause.classList.toggle('is-off', !save.settings.sfx);
    btnBgmPause.classList.toggle('is-off', !save.settings.bgm);
    const master = save.settings.sfx || save.settings.bgm;
    soundLabelMenu.textContent = t(lang, master ? 'soundOn' : 'soundOff');
    soundIcoMenu.textContent = master ? '♪' : '✕';
  };

  const applySound = (): void => {
    audio.setSfx(save.settings.sfx);
    audio.setBgm(save.settings.bgm);
    renderSoundLabels();
  };

  const toggleSfx = (): void => {
    audio.unlock();
    save = { ...save, settings: { ...save.settings, sfx: !save.settings.sfx } };
    persist();
    applySound();
    audio.playUi();
  };

  const toggleBgm = (): void => {
    audio.unlock();
    save = { ...save, settings: { ...save.settings, bgm: !save.settings.bgm } };
    persist();
    applySound();
    audio.playUi();
  };

  const toggleMaster = (): void => {
    audio.unlock();
    const on = !(save.settings.sfx || save.settings.bgm);
    save = { ...save, settings: { ...save.settings, sfx: on, bgm: on } };
    persist();
    applySound();
    if (on) audio.playUi();
  };

  /* ------------------------------------------------------------------- menu */

  const refreshMenuStats = (): void => {
    menuBest.textContent = String(save.best);
    hudBest.textContent = String(Math.max(save.best, game.score));
    menuCount.textContent = `${save.discovered.length}/${ALL_DEFS.length}`;
  };

  const show = (el: HTMLElement, visible: boolean): void => {
    el.hidden = !visible;
  };

  const setHud = (visible: boolean): void => {
    hud.classList.toggle('is-hidden', !visible);
  };

  const showMenu = (): void => {
    game.toMenu();
    show(screenMenu, true);
    show(screenOver, false);
    show(screenPause, false);
    show(screenCollection, false);
    show(screenLegend, false);
    setHud(false);
    refreshMenuStats();
  };

  const startRun = (): void => {
    audio.unlock();
    game.setBest(save.best);
    game.start();
    runCommitted = false;
    lastScore = -1;
    show(screenMenu, false);
    show(screenOver, false);
    show(screenPause, false);
    show(screenCollection, false);
    show(screenLegend, false);
    setHud(true);
    renderer.resize();
    if (save.settings.bgm) audio.startBgm();
  };

  const commitCurrentRun = (): void => {
    if (runCommitted) return;
    runCommitted = true;
    save = commitRun(save, game.score, game.discovered);
    persist();
    refreshMenuStats();
  };

  /** Keeps the best score and the collection safe even if the tab is closed mid-run. */
  const flushProgress = (): void => {
    if (game.state === 'idle') return;
    save = mergeProgress(save, game.score, game.discovered);
    persist();
  };

  const openCollection = (): void => {
    game.pause();
    // Draw the grid first so the NEW badges of this run are visible, then clear them.
    renderCollection();
    save = markSeen(save);
    persist();
    show(screenCollection, true);
    audio.playUi();
  };

  const closeCollection = (): void => {
    show(screenCollection, false);
    if (game.state === 'paused') {
      show(screenPause, true);
    }
  };

  const togglePause = (): void => {
    if (game.state === 'playing') {
      game.pause();
      show(screenPause, true);
      audio.playUi();
    } else if (game.state === 'paused') {
      game.resume();
      show(screenPause, false);
      audio.playUi();
    }
  };

  const quitToMenu = (): void => {
    commitCurrentRun();
    showMenu();
    audio.playUi();
  };

  const restart = (): void => {
    startRun();
  };

  /* ------------------------------------------------------------- collection */

  const renderCollection = (): void => {
    const found = new Set(save.discovered);
    const unseen = new Set(save.unseen);
    const build = (def: BubbleDef, legendFrame: boolean): HTMLElement => {
      const has = found.has(def.id);
      const item = document.createElement('div');
      item.className = `coll-item${has ? '' : ' locked'}${legendFrame ? ' legend' : ''}`;
      const img = document.createElement('img');
      img.src = spriteUrl(def.sprite);
      img.alt = has ? localized(lang, def.name) : t(lang, 'locked');
      img.loading = 'lazy';
      item.appendChild(img);

      if (!has && def.hint) {
        const hint = document.createElement('span');
        hint.className = 'coll-hint';
        hint.textContent = localized(lang, def.hint);
        item.appendChild(hint);
      }

      const name = document.createElement('span');
      name.className = 'coll-name';
      name.textContent = has ? localized(lang, def.name) : t(lang, 'locked');
      item.appendChild(name);

      if (has && unseen.has(def.id)) {
        const badge = document.createElement('span');
        badge.className = 'coll-new';
        badge.textContent = t(lang, 'new');
        item.appendChild(badge);
      }
      return item;
    };

    collectionGrid.replaceChildren(...[...MOMO_LINE, ...KOMI_LINE].map((def) => build(def, false)));
    collectionSpecials.replaceChildren(...[LEGENDARY, TROPHY_HANBOK, TROPHY_GOLD].map((def) => build(def, true)));
    collectionProgress.textContent = `${save.discovered.length}/${ALL_DEFS.length}`;
    menuCount.textContent = `${save.discovered.length}/${ALL_DEFS.length}`;
  };

  /* -------------------------------------------------------------- feedback */

  const showToast = (def: BubbleDef): void => {
    toast.innerHTML = '';
    const img = document.createElement('img');
    img.src = spriteUrl(def.sprite);
    img.alt = '';
    toast.appendChild(img);
    const label = document.createElement('span');
    label.textContent = localized(lang, def.name);
    toast.appendChild(label);
    const badge = document.createElement('span');
    badge.className = 'toast-new';
    badge.textContent = t(lang, 'new');
    toast.appendChild(badge);
    toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 1900);
  };

  const showCombo = (value: number): void => {
    comboPop.textContent = `${t(lang, 'combo')} x${value}`;
    comboPop.classList.remove('show');
    void comboPop.offsetWidth;
    comboPop.classList.add('show');
  };

  const showLegendary = (points: number): void => {
    legendBonus.textContent = `+${points}`;
    show(screenLegend, true);
    window.clearTimeout(legendTimer);
    legendTimer = window.setTimeout(() => show(screenLegend, false), 3600);
  };

  const handleEvents = (events: GameEvent[]): void => {
    for (const ev of events) {
      switch (ev.type) {
        case 'drop':
          audio.playDrop();
          break;
        case 'merge': {
          const color = ev.def.tint;
          renderer.burst(ev.x, ev.y, color, 1 + ev.def.level * 0.18, 12 + ev.def.level * 3);
          renderer.ring(ev.x, ev.y, color, 40 + ev.def.level * 26, 5);
          renderer.floater(ev.x, ev.y - ev.def.radius, `+${ev.points}`);
          audio.playMerge(ev.def.level, ev.combo);
          break;
        }
        case 'absorb':
          renderer.burst(ev.x, ev.y, ev.def.tint, 1.6, 24);
          renderer.ring(ev.x, ev.y, '#ffe9a8', 120, 7);
          renderer.floater(ev.x, ev.y - ev.def.radius, `+${ev.points}`, '#ffe9a8', 28);
          audio.playAbsorb();
          break;
        case 'legendary':
          renderer.implode(ev.x, ev.y, '#ffe9a8', 34);
          renderer.legendaryBurst(ev.x, ev.y);
          renderer.floater(ev.x, ev.y - 40, `+${ev.points}`, '#ffe9a8', 40);
          audio.playLegendary();
          showLegendary(ev.points);
          break;
        case 'combo':
          showCombo(ev.value);
          audio.playCombo(ev.value);
          break;
        case 'discover': {
          const def = ALL_DEFS.find((d) => d.id === ev.id);
          flushProgress();
          if (def && (def.level >= 3 || def.special)) {
            showToast(def);
            audio.playDiscover();
          }
          break;
        }
        case 'gameover':
          audio.playGameOver();
          commitCurrentRun();
          finalScore.textContent = String(ev.score);
          finalBest.textContent = String(Math.max(save.best, ev.score));
          recordBadge.hidden = !ev.best;
          show(screenOver, true);
          setHud(false);
          break;
      }
    }
  };

  /* ------------------------------------------------------------------- loop */

  const syncHud = (): void => {
    if (scoreValue.textContent !== String(game.score)) {
      scoreValue.textContent = String(game.score);
      if (game.score > lastScore && lastScore >= 0) {
        scoreValue.classList.remove('bump');
        void scoreValue.offsetWidth;
        scoreValue.classList.add('bump');
      }
      lastScore = game.score;
    }
    hudBest.textContent = String(Math.max(save.best, game.score));
    if (game.next) nextBubble.src = spriteUrl(game.next.sprite);
    const mult = 1 + Math.max(0, game.combo - 1) * 0.2;
    comboChip.textContent = `x${mult.toFixed(1).replace('.0', '')}`;
    dangerBadge.classList.toggle('show', game.dangerRatio() > 0.12 && game.state === 'playing');
  };

  let last = performance.now();
  const frame = (now: number): void => {
    const dt = now - last;
    last = now;
    game.step(dt);
    handleEvents(game.drainEvents());
    renderer.draw(game, dt);
    syncHud();
    requestAnimationFrame(frame);
  };

  /* ------------------------------------------------------------------ input */

  const pointToWorldX = (clientX: number, clientY: number): number => renderer.toWorld(clientX, clientY).x;

  board.addEventListener('pointerdown', (e: PointerEvent) => {
    if (game.state !== 'playing') return;
    // HUD buttons live inside .board: never let a tap on one turn into a captured drag.
    if ((e.target as HTMLElement | null)?.closest('button, a, input')) return;
    audio.unlock();
    dragging = true;
    game.setPointer(pointToWorldX(e.clientX, e.clientY));
    board.setPointerCapture?.(e.pointerId);
  });

  board.addEventListener('pointermove', (e: PointerEvent) => {
    if (game.state !== 'playing') return;
    if (dragging || e.pointerType === 'mouse') game.setPointer(pointToWorldX(e.clientX, e.clientY));
  });

  const release = (e: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    if (game.state !== 'playing') return;
    game.setPointer(pointToWorldX(e.clientX, e.clientY));
    game.drop();
  };

  board.addEventListener('pointerup', release);
  board.addEventListener('pointercancel', () => {
    dragging = false;
  });
  board.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (game.state === 'playing') {
      if (e.key === 'ArrowLeft') game.setPointer(game.dropX - 28);
      else if (e.key === 'ArrowRight') game.setPointer(game.dropX + 28);
      else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        game.drop();
      } else if (e.key === 'Escape') togglePause();
    } else if (e.key === 'Escape' && game.state === 'paused') {
      togglePause();
    }
  });

  /* ----------------------------------------------------------------- wiring */

  q<HTMLButtonElement>('#btnPlay').addEventListener('click', () => {
    audio.unlock();
    audio.playUi();
    startRun();
  });
  q<HTMLButtonElement>('#btnCollection').addEventListener('click', openCollection);
  q<HTMLButtonElement>('#btnCloseCollection').addEventListener('click', closeCollection);
  q<HTMLButtonElement>('#btnPause').addEventListener('click', togglePause);
  q<HTMLButtonElement>('#btnResume').addEventListener('click', togglePause);
  q<HTMLButtonElement>('#btnPauseRestart').addEventListener('click', restart);
  q<HTMLButtonElement>('#btnPauseMenu').addEventListener('click', quitToMenu);
  q<HTMLButtonElement>('#btnRestart').addEventListener('click', restart);
  q<HTMLButtonElement>('#btnOverMenu').addEventListener('click', quitToMenu);
  q<HTMLButtonElement>('#btnReset').addEventListener('click', () => {
    if (!window.confirm(t(lang, 'resetConfirm'))) return;
    save = { ...defaultSave(), settings: save.settings };
    persist();
    game.setBest(0);
    game.discovered.clear();
    renderCollection();
    refreshMenuStats();
  });

  btnSoundMenu.addEventListener('click', toggleMaster);
  btnSfx.addEventListener('click', toggleSfx);
  btnBgm.addEventListener('click', toggleBgm);
  btnSfxPause.addEventListener('click', toggleSfx);
  btnBgmPause.addEventListener('click', toggleBgm);
  btnLang.addEventListener('click', () => setLang(lang === 'en' ? 'ko' : 'en'));

  screenLegend.addEventListener('click', () => {
    window.clearTimeout(legendTimer);
    show(screenLegend, false);
  });

  const onResize = (): void => {
    renderer.resize();
    game.setWorldHeight(renderer.worldHeight);
    const boardTop = board.getBoundingClientRect().top;
    const hudBottom = hud.getBoundingClientRect().bottom - boardTop;
    const dangerY = renderer.cssToWorldY(hudBottom + 14);
    game.setLayout(dangerY, dangerY + 62);
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  if ('ResizeObserver' in window) {
    new ResizeObserver(onResize).observe(board);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      flushProgress();
      if (game.state === 'playing') togglePause();
    }
  });
  window.addEventListener('pagehide', flushProgress);

  refreshText();
  renderCollection();
  refreshMenuStats();
  onResize();
  showMenu();
  requestAnimationFrame((t0) => {
    last = t0;
    requestAnimationFrame(frame);
  });
}
