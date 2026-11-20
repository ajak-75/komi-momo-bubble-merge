# 🫧 KOMI & MOMO BUBBLE SHOOTER

코미와 모모 버블을 아래 대포로 쏘아 올려 **같은 색 3개 이상을 붙여 터뜨리는** 클래식 버블 슈터(퍼즐 보블 방식).
`Vite + TypeScript + HTML5 Canvas + Web Audio` 로 만든 **0원 정적 웹게임**이며, 외부 CDN·서버·유료 API 없이 GitHub Pages에서 그대로 실행됩니다.

- 플레이: <https://ajak-75.github.io/komi-momo-bubble-merge/>
- 만든 곳: Ajak Studio

## 게임 규칙

- 천장에 매달린 육각 격자 보드에 버블이 3줄 깔린 채 시작합니다.
- 아래 대포를 좌우로 조준해 쏘면, 천장이나 다른 버블에 닿아 **가장 가까운 빈 칸**에 착지합니다.
- 같은 색 버블이 **3개 이상** 붙으면 팡 터지고 점수를 얻습니다. 이어서 터뜨리면 콤보 배수가 붙습니다(x4까지).
- 천장과 연결이 끊긴 버블은 우르르 떨어지며 **낙하 보너스** 점수를 줍니다.
- 정해진 샷 수마다 천장이 한 줄씩 내려오고, 버블이 **위험선**을 넘으면 게임 오버 → 다시 하기.
- 보드를 다 비우면 스테이지 클리어 보너스를 받고 다음 스테이지로 이어집니다(무한 진행, 갈수록 줄·색이 늘어남).

| 색 | 스프라이트 | 모티브 |
| --- | --- | --- |
| violet | `violet.webp` | 모모 발바닥 |
| red | `red.webp` | 단청 꽃 |
| mint | `mint.webp` | 베레모 |
| pink | `pink.webp` | 리본 |
| sky | `sky.webp` | 한복 |
| gold | `gold.webp` | 황금 대왕 |

## 조작

- 모바일: 화면을 **터치·드래그**해 조준(점선 가이드 + 벽 반사 1회 미리보기), **떼면 발사**. 좌하단/우하단 스왑 버튼으로 현재·다음 버블을 교체.
- PC: 마우스 이동 → 클릭, 또는 `←` `→` 이동 · `Space` 발사 · `Esc` 일시정지.
- 375px 세로 화면 기준으로 스크롤 없이 한 판이 들어가며, 화면 크기에 맞춰 자동 리사이즈됩니다.

## 화면

- **메인**: 로고 · PLAY · 이어하기 · BEST · 효과음/BGM 토글
- **게임**: 점수 · 스테이지 · 최고점 · 다음 버블 · 스왑 · 일시정지 · 위험선
- **일시정지**: 계속하기 · 다시 하기 · 메뉴 · 효과음/BGM 토글
- **클리어/게임오버**: 보너스·최종 점수 · 최고 기록 배지 · 다시 하기
- **다국어**: 기기 언어 자동 감지(한국어/영어), 설정에서 전환
- **저장**: 최고 점수·도달 스테이지·설정을 `localStorage`에 저장하고 탭을 떠날 때도 안전하게 기록

## 개발

```bash
npm install
npm run dev      # http://127.0.0.1:5173
npm run build    # tsc --noEmit + vite build → docs/
npm test         # 육각 격자·조준/반사·매칭/낙하·게임 규칙·저장 자동 테스트 (vitest)
npm run verify   # 타입체크 + 테스트 + 빌드 한 번에
```

빌드 결과는 `docs/` 에 생성되며, `main` 브랜치의 `/docs` 폴더를 GitHub Pages 소스로 쓰기 때문에
별도 워크플로우 없이 배포됩니다. (`vite.config.ts` 의 `base` 는 상대 경로)

## 구조

```
src/core/      DOM 없는 순수 시뮬레이션 (테스트 대상)
  types.ts     버블·색·이벤트 타입
  hex.ts       육각 격자 기하 (열 수·중심 좌표·이웃 칸)
  aim.ts       조준 각도·벽 반사 경로 추적 (조준선 = 실제 탄도)
  match.ts     3개 이상 연결 찾기 · 천장과 끊긴 버블 찾기
  config.ts    버블 6색 정의·스테이지 곡선·점수 상수
  game.ts      보드·대포·발사·착지·폭발·낙하·줄 내리기·게임오버
  storage.ts   localStorage 저장/복구 (손상된 데이터도 안전하게)
  rng.ts       시드 고정 난수 (테스트·재현용)
src/render.ts  Canvas 렌더러 (버블·조준 점선·파티클·흔들림·점수 팝업)
src/audio.ts   Web Audio 합성 효과음 + BGM
src/i18n.ts    EN / KO 문자열
src/app.ts     화면 전환·입력·저장·이벤트 연결
tests/         vitest 자동 테스트 40건
scripts/       에셋 파이프라인(build_bubbles.py) · 샌드박스 DNS 패치
```

## 에셋

`work/ajak-studio/komi-pop/chars/stage-0~8.webp`(공식 유리 버블 컷)에서 6색을 골라
`scripts/build_bubbles.py` 로 320px WebP를 다시 뽑습니다. 테두리에 색 링을 덧그리지 않아
어두운 보드에서도 유리 가장자리가 깨끗합니다.

## English

**KOMI & MOMO BUBBLE SHOOTER** is a classic bubble shooter: aim the cannon at the bottom, fire a bubble
into the hex board at the top, and pop three or more of the same colour. Detached bubbles fall for a
bonus, the ceiling drops a row every few shots, and the stage curve keeps going.
Pure static site — no backend, no CDN, no paid services. Vite + TypeScript, a hand-written hex grid
and shot tracer, and synthesised Web Audio sound. `npm test` covers the lattice, aiming/bounce paths,
matching, drops, the run rules and the save file.
