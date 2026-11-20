import type { Lang } from './core/types';

/** KO / EN. Every string the screen shows lives here (no external font or i18n file). */
export const STRINGS = {
  en: {
    title: 'BUBBLE SHOOTER',
    tagline: 'Aim, bounce, pop three of a kind.',
    play: 'PLAY',
    resume: 'RESUME',
    stage: 'STAGE',
    score: 'SCORE',
    best: 'BEST',
    next: 'NEXT',
    swap: 'SWAP',
    pause: 'PAUSE',
    paused: 'PAUSED',
    main: 'MAIN',
    restart: 'PLAY AGAIN',
    gameOver: 'GAME OVER',
    finalScore: 'SCORE',
    reached: 'STAGE',
    newRecord: 'NEW RECORD!',
    stageClear: 'STAGE CLEAR',
    stageClearBody: 'The board is empty. Next stage is waiting.',
    nextStage: 'NEXT STAGE',
    bonus: 'BONUS',
    danger: 'DANGER',
    rowIn: 'ROW IN',
    sound: 'SOUND',
    sfx: 'SFX',
    bgm: 'MUSIC',
    on: 'ON',
    off: 'OFF',
    language: 'LANGUAGE',
    howTo1: 'Drag to aim, release to fire.',
    howTo2: 'Bubbles bounce off the side walls.',
    howTo3: 'Match 3 of the same colour to pop them.',
    howTo4: 'Bubbles left hanging fall for bonus points.',
    tapHint: 'DRAG TO AIM · RELEASE TO FIRE',
    combo: 'COMBO',
    pops: 'POP!',
    dropBonus: 'DROP',
    about: 'Bubble shooter · Ajak Studio',
    rotate: 'Rotate your phone to portrait',
    continueAt: 'CONTINUE',
    sfxOn: 'SFX ON',
    sfxOff: 'SFX OFF',
    hard: 'HARD',
  },
  ko: {
    title: '버블 슈터',
    tagline: '조준하고, 튕기고, 같은 버블 3개를 터뜨려요.',
    play: '플레이',
    resume: '계속하기',
    stage: '스테이지',
    score: '점수',
    best: '최고',
    next: '다음',
    swap: '교체',
    pause: '일시정지',
    paused: '일시정지',
    main: '메인',
    restart: '다시 하기',
    gameOver: '게임 오버',
    finalScore: '점수',
    reached: '스테이지',
    newRecord: '신기록!',
    stageClear: '스테이지 클리어',
    stageClearBody: '보드를 모두 비웠어요. 다음 스테이지가 기다려요.',
    nextStage: '다음 스테이지',
    bonus: '보너스',
    danger: '위험',
    rowIn: '줄 추가',
    sound: '소리',
    sfx: '효과음',
    bgm: '배경음악',
    on: '켜짐',
    off: '꺼짐',
    language: '언어',
    howTo1: '드래그로 조준하고 손을 떼면 발사!',
    howTo2: '버블은 좌우 벽에 튕겨요.',
    howTo3: '같은 버블 3개가 붙으면 팡!',
    howTo4: '천장과 끊긴 버블은 떨어져 보너스!',
    tapHint: '드래그로 조준 · 손 떼면 발사',
    combo: '콤보',
    pops: '팡!',
    dropBonus: '낙하',
    about: '버블 슈터 · Ajak Studio',
    rotate: '세로로 돌려 주세요',
    continueAt: '이어서',
    sfxOn: '효과음 켜짐',
    sfxOff: '효과음 꺼짐',
    hard: '어려움',
  },
} as const;

export type StringKey = keyof (typeof STRINGS)['en'];

export function t(lang: Lang, key: StringKey): string {
  return STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
}

export function applyStaticText(root: ParentNode, lang: Lang): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n as StringKey;
    if (key in STRINGS.en) el.textContent = t(lang, key);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => {
    const key = el.dataset.i18nAria as StringKey;
    if (key in STRINGS.en) el.setAttribute('aria-label', t(lang, key));
  });
}
