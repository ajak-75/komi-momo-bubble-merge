# 🫧 KOMI & MOMO BUBBLE MERGE

코미와 모모를 합쳐 **레전더리 버블**을 만드는 캐주얼 합치기 퍼즐.
`Vite + TypeScript + HTML5 Canvas + 자체 2D 원형 물리 + Web Audio` 로 만든 **0원 정적 웹게임**입니다.
외부 CDN·서버·유료 API·이미지 파일(효과음/BGM) 없이 GitHub Pages에서 그대로 실행됩니다.

- 플레이: <https://ajak-75.github.io/komi-momo-bubble-merge/>
- 만든 곳: Ajak Studio

## 게임 규칙

두 개의 **독립 진화 계열**이 있습니다. 서로 다른 계열은 부딪히기만 하고 절대 합쳐지지 않습니다.

| 단계 | MOMO 계열 | KOMI 계열 |
| --- | --- | --- |
| 1 | 모모 발바닥 (`momo_paw`) | 단청 꽃 (`komi_flower`) |
| 2 | MOMO BASIC · 블루 후드 (`momo_basic`) | KOMI BASIC · 핑크 리본 (`komi_basic`) |
| 3 | MOMO COSTUME · 베레모 (`momo_costume`) | KOMI COSTUME · 하트 선글라스 (`komi_costume`) |
| 4 | MOMO ROYAL · 왕관+전통의상 (`momo_royal`) | KOMI ROYAL · 왕관+전통의상 (`komi_royal`) |

- 같은 계열 + 같은 단계 = 다음 단계로 진화
- **MOMO ROYAL + KOMI ROYAL = LEGENDARY KOMI & MOMO** (슬로모션 · 황금 파티클 · `LEGENDARY!` 배너 · 팡파레 · 보너스 점수)
- 최고 단계끼리(로열+로열, 레전더리+무엇이든) 부딪히면 하나가 흡수되고 **보너스 점수**만 지급
- 콤보: 1.5초 안에 연속 합체하면 최대 **x2.6** 배 점수
- 상단 기준선 위에 버블이 2.2초 이상 머물면 게임 오버 (최고 점수 · 도감은 유지)

## 조작

- 모바일: 화면을 **드래그**해서 위치를 옮기고 손을 떼면 드롭, **탭**만 해도 드롭
- PC: 마우스 이동 → 클릭, 또는 `←` `→` 이동 · `Space` 드롭 · `Esc` 일시정지
- 세로 9:16 기준 레이아웃, 화면 크기에 맞춰 자동 리사이즈

## 화면

- **메인**: 로고 · 히어로 일러스트 · PLAY · COLLECTION · SOUND ON/OFF · BEST
- **게임**: 점수/최고점 · 다음 버블 · 일시정지 · 효과음/배경음 개별 토글 · 위험 기준선
- **도감**: 11종(진화 8 + 스페셜 3). 미발견 실루엣, 신규 발견 `NEW` 배지, 레전더리 황금 프레임, `localStorage` 영구 저장
- **레전더리**: 합체 순간 전용 축하 연출
- **다국어**: 영어 기본, `EN`/`KO` 토글로 한국어 전환

## 개발

```bash
npm install
npm run dev      # http://127.0.0.1:5173
npm run build    # tsc --noEmit + vite build → docs/
npm test         # 물리·병합·게임오버·저장 자동 테스트 (vitest)
npm run verify   # 타입체크 + 테스트 + 빌드 한 번에
```

빌드 결과는 `docs/` 에 생성되며, `main` 브랜치의 `/docs` 폴더를 GitHub Pages 소스로 쓰기 때문에
별도 워크플로우 없이 배포됩니다. (`vite.config.ts` 의 `base` 는 `/komi-momo-bubble-merge/`)

## 구조

```
src/core/      DOM 없는 순수 시뮬레이션 (테스트 대상)
  config.ts    버블 정의·물리 상수·도감 순서
  physics.ts   원형 전용 2D 물리 (중력·반발·마찰·겹침 방지·화면 이탈 방지·결정론)
  merge.ts     "이 둘은 합쳐지는가" 단일 규칙 함수
  game.ts      스폰·드롭·병합·콤보·점수·게임오버·도감 해금
  storage.ts   localStorage 저장/복구 (손상된 데이터도 안전하게)
src/render.ts  Canvas 렌더러 (글로우·파티클·슬로모션·레전더리 아우라)
src/audio.ts   Web Audio 합성 효과음 + 4마디 BGM (SFX/BGM 개별 게인)
src/i18n.ts    EN / KO 문자열
src/app.ts     화면 전환·입력·저장·이벤트 연결
tests/         vitest 자동 테스트 42건
scripts/       에셋 파이프라인(build_assets.py) · 샌드박스 DNS 패치
```

## 에셋

공식 9종 버블 시트 + 타이틀/레전더리 비주얼을 원형 투명 PNG/WebP로 정밀 크롭했고,
시트에 없는 **MOMO ROYAL**과 **LEGENDARY** 버블은 같은 3D 유리구슬 스타일로 생성해 누끼 처리했습니다.
재생성: `python3 scripts/build_assets.py --sheet … --title … --legend … --momo-royal … --legendary-orb …`

## English

**KOMI & MOMO BUBBLE MERGE** is a cozy merge puzzle: paw bubbles grow into MOMO, flower bubbles
grow into KOMI, and the two royal lines fuse into the LEGENDARY KOMI & MOMO bubble.
Pure static site — no backend, no CDN, no paid services. Built with Vite + TypeScript,
a custom deterministic circle physics engine and synthesised Web Audio sound.
`npm test` covers the merge rules, physics invariants, game-over/restart flow and save file.
