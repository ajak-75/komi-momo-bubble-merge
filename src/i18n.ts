import type { Lang } from './core/types';

export const STRINGS = {
  en: {
    subtitle: 'BUBBLE MERGE',
    tagline: 'Merge the paw. Merge the flower. Crown them both.',
    play: 'PLAY',
    collection: 'COLLECTION',
    best: 'BEST',
    score: 'SCORE',
    next: 'NEXT',
    pause: 'PAUSE',
    paused: 'PAUSED',
    resume: 'RESUME',
    main: 'MAIN',
    restart: 'PLAY AGAIN',
    gameOver: 'GAME OVER',
    finalScore: 'FINAL SCORE',
    newRecord: 'NEW RECORD!',
    sound: 'SOUND',
    sfx: 'SFX',
    bgm: 'MUSIC',
    language: 'LANGUAGE',
    howTo: 'Drop bubbles from above.',
    howTo2: 'Paw + Paw grows MOMO. Flower + Flower grows KOMI.',
    howTo3: 'Never mix the two lines. Crown them both to fuse LEGENDARY!',
    tapHint: 'DRAG OR TAP TO DROP',
    danger: 'DANGER',
    combo: 'COMBO',
    legendary: 'LEGENDARY!',
    legendarySub: 'KOMI ROYAL + MOMO ROYAL',
    legendaryBody: 'The two royal lines have become one golden bubble.',
    bonus: 'BONUS',
    collectionTitle: 'COLLECTION',
    collectionFound: 'FOUND',
    evolution: 'EVOLUTION',
    special: 'SPECIAL',
    new: 'NEW',
    locked: '???',
    level: 'LV',
    tapToClose: 'TAP TO CLOSE',
    reset: 'RESET DATA',
    resetConfirm: 'Erase best score and the whole collection?',
    yes: 'RESET',
    no: 'CANCEL',
    runs: 'RUNS',
    keepGoing: 'CONTINUE',
    myBest: 'MY BEST',
    newDiscovery: 'NEW BUBBLE!',
    trophyHanbokHint: 'Reach 2,000 points in one run',
    trophyGoldHint: 'Fuse the legendary bubble',
    soundOn: 'SOUND ON',
    soundOff: 'SOUND OFF',
    merged: 'MERGED',
    maxed: 'MAX',
    about: 'Merge puzzle · Ajak Studio',
  },
  ko: {
    subtitle: '버블 머지',
    tagline: '발바닥은 모모, 꽃은 코미. 둘 다 왕관을 씌워 레전더리로!',
    play: '플레이',
    collection: '도감',
    best: '최고',
    score: '점수',
    next: '다음',
    pause: '일시정지',
    paused: '일시정지',
    resume: '계속하기',
    main: '메인',
    restart: '다시 하기',
    gameOver: '게임 오버',
    finalScore: '최종 점수',
    newRecord: '신기록!',
    sound: '소리',
    sfx: '효과음',
    bgm: '배경음악',
    language: '언어',
    howTo: '위에서 버블을 떨어뜨리세요.',
    howTo2: '발바닥+발바닥은 모모, 꽃+꽃은 코미로 진화해요.',
    howTo3: '두 계열은 섞이지 않아요. 각 계열 로열을 합치면 레전더리!',
    tapHint: '드래그 또는 탭해서 떨어뜨리기',
    danger: '위험',
    combo: '콤보',
    legendary: '레전더리!',
    legendarySub: '코미 로열 + 모모 로열',
    legendaryBody: '두 왕가의 버블이 하나의 황금 버블이 되었어요.',
    bonus: '보너스',
    collectionTitle: '도감',
    collectionFound: '발견',
    evolution: '진화 계열',
    special: '스페셜',
    new: 'NEW',
    locked: '???',
    level: '단계',
    tapToClose: '탭해서 닫기',
    reset: '기록 초기화',
    resetConfirm: '최고 점수와 도감을 모두 지울까요?',
    yes: '초기화',
    no: '취소',
    runs: '플레이',
    keepGoing: '계속하기',
    myBest: '내 최고',
    newDiscovery: '새 버블 발견!',
    trophyHanbokHint: '한 판에 2,000점 달성',
    trophyGoldHint: '레전더리 버블 합체 성공',
    soundOn: '소리 켜짐',
    soundOff: '소리 꺼짐',
    merged: '합체',
    maxed: '최고 단계',
    about: '합치기 퍼즐 · Ajak Studio',
  },
} as const;

export type StringKey = keyof (typeof STRINGS)['en'];

export function t(lang: Lang, key: StringKey): string {
  return STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
}

export function localized(lang: Lang, text: { en: string; ko: string }): string {
  return text[lang] ?? text.en;
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
