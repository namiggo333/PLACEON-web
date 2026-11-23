# 이곳저곳 모바일 시인성 · 폰트 · 동선 진단과 구현 설계

- 작성: 2026-11-23 (코드 진단 only — `placeon-web` 앱 코드는 한 줄도 수정하지 않았습니다)
- 대상: `placeon-web/` (= https://igotjeogot.com, master `49a895c`(2026-11-20 공유카드 수정) 기준 파일들)
- 목적: ① 폰트 굵기 위계가 실제로 살아나게 만드는 정적 Pretendard 교체 설계, ② 모바일 시인성 결함 목록(파일:줄), ③ 고객/사장님 동선 개선 목록

---

## 0. 결론 3줄

1. **지금 사이트는 모든 글자가 400 굵기 하나로 그려지고 있습니다.** 파일이 잘못된 게 아니라, 가변 폰트를 92조각 unicode-range로 쪼개 쓰는 현재 방식에서 굵기 축이 무시되는 현상이 실측으로 확인됐습니다. → **정적 웨이트(400/500/600/700/800)로 교체하면 해결됩니다.** 준비물(폰트 5종·CSS)은 이미 받아 두었습니다.
2. 시인성을 깎는 원인은 폰트만이 아닙니다. **10~11px 글자 219곳**, **pinch zoom 차단(`maximumScale: 1`)**, **28px짜리 버튼**, **12px 계좌번호**가 함께 있습니다.
3. 고객 동선은 "날짜 축 없는 검색 → 긴 상세 → 예약 폼" 구조이고, 사장님 동선은 **QR·공유시트 없이 클립보드 복사만** 있습니다. 둘 다 3~5개 화면 수정으로 체감이 크게 바뀝니다.

---

## 1. 폰트: 무엇이 어떻게 잘못됐나 (실측)

### 1-1. 현재 구성

| 항목 | 값 |
| --- | --- |
| CSS | `src/app/pretendard-fontface.css` — `@font-face` **92개**, 모두 `font-family: 'Pretendard Variable'`, `font-weight: 45 920`, unicode-range 분할 |
| 파일 | `public/fonts/pretendard/PretendardVariable.subset.{0..91}.woff2` (총 3.1MB, 서빙 200 OK 확인) |
| 로드 방식 | `src/app/layout.tsx:2` `import "./pretendard-fontface.css"` |
| 패밀리 지정 | `src/app/globals.css:39` `--font-sans: "Pretendard Variable", Pretendard, …` / `tailwind.config.ts:43` |
| 굵기 사용 | 400(본문 기본) · 500 `font-medium` 24곳 · 600 `font-semibold` 113곳 · 700 `font-bold` 197곳 · 800 `font-extrabold` 117곳 (900 사용 없음) |

### 1-2. 실측 결과 (원격 Chrome, https://igotjeogot.com 라이브)

| 측정 | 결과 | 의미 |
| --- | --- | --- |
| `"지금 바로 찾아보세요"` 44px 텍스트 폭 | 400 = **364.34px**, 700 = **364.34px**, 800 = **364.34px** (완전 동일) | 굵기에 따라 폭이 바뀌지 않음 = 축 미적용 |
| canvas 픽셀 잉크량(같은 글자, 100/400/500/700/800) | 5개 웨이트 모두 **2065 px / 완전 동일** | 굵기별 렌더링 차이 없음 |
| 같은 폰트 파일을 단일 `@font-face`(unicode-range 없음)로 등록 | 400 = 4402, **800 = 4807** (달라짐) | **파일 자체는 정상 가변 폰트** |
| `font-variation-settings: "wght" 800` 강제 | 폭 변화 없음(364.34) | 이 환경에서는 축 자체가 무시됨 |
| fontTools로 400/800 인스턴스 비교 | `A` 자폭 1322 → **1520**, `공` bbox도 확대 | 폰트에 진짜 800 데이터가 있음 |
| `document.fonts` | 92개 face 전부 `weight: 45 920` | 선언은 정상 |

> 정리: **폰트 파일은 정상인데, 92조각 unicode-range + 가변 웨이트 조합에서 Chromium이 400 인스턴스만 그립니다.**
> 11-20 폰트 리뉴얼 때 나온 "원격 Chrome에서 variable 굵기 축이 400으로 그려진다"는 관찰이 **지금도 그대로 재현**됩니다.
> 아이폰 Safari는 이 세션에서 확인할 수 없어 **미확인**입니다(사용자 실기기 확인 필요).

> 비교 이미지: 워크스페이스 `downloads/이곳저곳-폰트-위계-비교-2026-11-23.png` (왼쪽 = 지금 화면, 오른쪽 = 정적 폰트 적용 후)

### 1-3. 그래서 정적 폰트가 답인 이유

정적 파일은 웨이트마다 **별개의 face**라서, 브라우저가 가변축을 지원하지 않아도 `font-weight: 800`에 해당하는 파일을 그대로 골라 그립니다. 축 해석에 기대지 않는 방식입니다.

---

## 2. 정적 Pretendard 교체 설계 (그대로 실행하면 되는 순서)

### 2-1. 준비 완료된 자산 (이미 받아 둠 — 커밋 전 상태)

`placeon-web/public/fonts/pretendard-static/`

| 파일 | 웨이트 | 크기 | 검증 |
| --- | --- | --- | --- |
| `Pretendard-Regular.subset.woff2` | 400 | 264KB | 정적(fvar 없음), usWeightClass=400, 한글 2,780자/4,381 글리프 |
| `Pretendard-Medium.subset.woff2` | 500 | 262KB | 〃 500 |
| `Pretendard-SemiBold.subset.woff2` | 600 | 263KB | 〃 600 |
| `Pretendard-Bold.subset.woff2` | 700 | 265KB | 〃 700 |
| `Pretendard-ExtraBold.subset.woff2` | 800 | 266KB | 〃 800 |
| `OFL.txt` | — | 4KB | SIL OFL 1.1 라이선스 |

출처: `pretendard@1.3.9` npm 배포의 `dist/web/static/woff2-subset/*.subset.woff2` (공식 정적 서브셋). `woff2-subset`은 KS X 1001 상용 한글을 담은 **단일 파일**이라 unicode-range 분할이 필요 없습니다.

### 2-2. 붙여 넣을 CSS (준비 완료)

`placeon-web/docs/font-static/pretendard-static-fontface.css` → **`placeon-web/src/app/pretendard-static-fontface.css`** 로 복사 후 사용.
내용: `font-family: "Pretendard"` + 웨이트 5개 discrete 선언, `font-display: swap`.

### 2-3. `src/app/layout.tsx` 수정 (2군데)

```diff
-import "./pretendard-fontface.css";
+import "./pretendard-static-fontface.css";
```

```diff
 export const viewport: Viewport = {
   width: "device-width",
   initialScale: 1,
-  maximumScale: 1,
+  // maximumScale 을 두면 모바일에서 확대(pinch zoom)가 막혀 작은 글씨를 키울 수 없다.
+  // 접근성(WCAG 1.4.4)에도 어긋나므로 해제한다.
   viewportFit: "cover",
   themeColor: "#FF2E7E",
 };
```

추가(선택, 첫 화면 굵기 깜빡임 감소) — `<html>` 위에 preload:

```tsx
<head>
  <link
    rel="preload"
    href="/fonts/pretendard-static/Pretendard-Regular.subset.woff2"
    as="font"
    type="font/woff2"
    crossOrigin="anonymous"
  />
</head>
```

> 800(제목)까지 함께 preload하면 530KB가 초기 경쟁에 들어가 모바일 체감이 나빠질 수 있어 **400만 preload**를 권장합니다.

### 2-4. `src/app/globals.css` 수정 (3군데)

```diff
-  --font-sans: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui,
+  --font-sans: "Pretendard", -apple-system, BlinkMacSystemFont, system-ui,
     "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif;
-  --font-display: "Jua", "Pretendard Variable", "Apple SD Gothic Neo", system-ui, sans-serif;
+  --font-display: "Jua", "Pretendard", "Apple SD Gothic Neo", system-ui, sans-serif;
```

```diff
   word-break: keep-all;
   overflow-wrap: break-word;
-  -webkit-font-smoothing: antialiased;
 }
```

> `-webkit-font-smoothing: antialiased`는 macOS·데스크톱에서 획을 얇게 만드는 방향으로 작동합니다(아이폰에서는 무시됨). "얇아 보인다"는 인상에 기여하므로 같이 정리하는 편이 좋습니다. `layout.tsx:70`의 `antialiased` 클래스도 함께 빼 주세요.

### 2-5. `tailwind.config.ts` 수정

```diff
         sans: [
-          "Pretendard Variable",
           "Pretendard",
           "-apple-system",
           ...
```

### 2-6. 폰트 캐시 헤더 (`next.config.mjs`) — 지금은 매번 재검증

현재 라이브 응답: `cache-control: public, max-age=0, must-revalidate`.
폰트는 내용이 바뀌지 않는 정적 자산이므로 헤더를 붙이면 재방문 비용이 사라집니다.

```js
async headers() {
  return [
    {
      source: "/fonts/:path*",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    },
  ];
},
```

> `immutable`은 파일명이 고정일 때 1년간 갱신을 막습니다. 나중에 폰트를 갱신할 때는 **파일명을 바꿔** 올려야 합니다(예: `Pretendard-Regular.v2.subset.woff2`). 파일명 교체가 부담이면 `max-age=2592000`(30일)로 두세요.

### 2-7. 정리(교체 확인 후)

- `src/app/pretendard-fontface.css`(928줄, import 제거됨) 삭제
- `public/fonts/pretendard/*.woff2` 92개(3.1MB) 삭제, `OFL.txt`만 남기거나 `pretendard-static/OFL.txt` 유지
- 남는 파일: `public/fonts/pretendard-static/` 5개(1.34MB) + Jua(1.1MB, 로고/초대카드용 유지)

### 2-8. 데이터 비용 비교 (정직하게)

| 방식 | 홈 1회 로드 폰트량 | 파일 수 | 비고 |
| --- | --- | --- | --- |
| **현재(가변 92조각)** | **300KB** (조각 11개) + 주아 73KB | 92 | 굵기 축이 죽음 |
| **정적 5종(권장)** | **1.34MB** (400/500/600/700/800) | 5 | 굵기 확실, 관리 단순 |
| 정적 4종(500→600 통일) | 1.06MB | 4 | `font-medium` 24곳이 600이 됨(살짝 무거워짐) |
| 가변 단일 파일(unicode-range 제거) | 2.0MB | 1 | 축이 살아날 가능성은 있으나 이 환경 검증 불가 + 가장 무거움 |
| 글자 서브셋(pyftsubset로 앱 문구만) | 약 250KB | 5 + 빌드 스크립트 | 손님 이름·메모 등 사용자 입력 글자는 시스템 폰트로 떨어짐 → 비권장 |

> 첫 방문에 약 **+1MB**, 이후 캐시. 모바일 LTE에서 0.3~0.6초 수준이고, 2-6의 캐시 헤더를 넣으면 재방문은 0이 됩니다. 굵기 위계가 죽어 있는 현재 상태를 그대로 두는 비용이 더 크다고 판단했습니다.
> 데이터를 더 줄여야 하면 **정적 dynamic-subset(92조각 × 웨이트)** 방식이 있지만 파일이 460개가 되어 관리가 어렵습니다.

### 2-9. 롤백

`layout.tsx`의 import 한 줄을 `pretendard-fontface.css`로 되돌리면 즉시 원상 복구됩니다(가변 파일을 지우기 전까지). 삭제는 2-7을 **배포 확인 후**에 하는 이유입니다.

### 2-10. 검증 체크리스트 (배포 전 로컬)

- [ ] `npm run build` 통과(타입/린트)
- [ ] DevTools Network: `Pretendard-*.subset.woff2` 200, 홈에서 3~4개(사용 웨이트)만 요청되는지
- [ ] DevTools Network에 `PretendardVariable.subset.*` 요청이 **0건**인지
- [ ] 폰 굵기 눈금 확인: 홈 h1(800)·섹션 제목(700)·카드 제목(700)·본문(400)이 실제로 구분되는지
- [ ] 아이폰 Safari 실기기: 제목이 굵게 보이는지(이번 진단에서 유일한 미확인 항목)
- [ ] `document.fonts` 콘솔에서 face 5개, `weight: 400/500/600/700/800`인지
- [ ] 핀치 줌이 동작하는지(2-3 반영 후)
- [ ] 공유 카드(OG)·초대 카드 캔버스는 NanumSquareRound/서버 폰트를 쓰므로 영향 없음 확인(`src/lib/og.tsx`)

---

## 3. 시인성 결함 목록 (파일:줄)

### P0 — 지금 바로 (한 화면에서 눈에 걸리는 것)

| # | 위치 | 문제 | 개선 |
| --- | --- | --- | --- |
| 1 | `src/app/layout.tsx:60` | `maximumScale: 1` → 모바일 확대 금지 | 삭제(2-3) |
| 2 | `src/app/pretendard-fontface.css` 전체 | 굵기 5단계가 1단계로 뭉개짐 | 정적 교체(2장) |
| 3 | `src/components/DepositGuide.tsx:158-186` | **계좌번호 12px**, 예금주 12px, 복사 버튼도 12px | 계좌번호 18px `tabular-nums` + "계좌번호 복사" 44px 버튼, 입금 금액 18→24px |
| 4 | `src/app/host/page.tsx:958, 966` | 사장님 핵심 액션 `입금 확인(확정)`/`예약 거절`이 **11px·28px 높이** | `h-11 px-4 text-[14px]` 이상, 확정 버튼은 브랜드 채움 |
| 5 | `src/**/*.tsx` — **12px 미만 글자 225곳**, 그중 **10.5px 이하 97곳**(`text-[10px]` 78 · `text-[10.5px]` 13 · `text-[9px]` 6). `app/host/page.tsx` 한 파일에만 62곳 | 폰에서 라벨·메타가 사실상 안 읽힘 | 최소 12px로 상향(라벨 12px·본문 13~15px) |

### P1 — 이번 배포에 같이

| # | 위치 | 문제 | 개선 |
| --- | --- | --- | --- |
| 6 | `src/app/spaces/[id]/SpaceDetailView.tsx:495,504` · `src/app/pay/[slug]/PayView.tsx:583,592` | 인원 ± 버튼이 **28px(h-7 w-7)** | 44px(h-11 w-11)로, 숫자는 17px |
| 7 | `src/app/spaces/[id]/SpaceDetailView.tsx:615` | 하단 고정 예약바 `bottom-16`이 하단 내비(높이 56px+safe-area)와 겹칠 수 있음 | `bottom-[calc(3.5rem+env(safe-area-inset-bottom))]`로 정확히 맞추기 |
| 8 | `src/components/HomeView.tsx:141-180` | 홈 필터 select 3개가 12px, 모바일에서 줄바꿈 | 14px + 아이콘 있는 칩 형태로, 필터는 `/search` 한 곳으로 모으기 |
| 9 | `src/app/search/page.tsx:85-130` | 필터 select 4개 12px이 2줄로 흩어짐 | 상단 sticky 필터바, 14px, 선택 시 개수 표시 |
| 10 | `src/app/host/page.tsx:1363,1370` | 사진 삭제/대표 지정 **9px**, 삭제 버튼 20px(h-5 w-5) | 뱃지 11px, 삭제 버튼 32px, "대표로"는 32px 높이 |
| 11 | `src/app/spaces/[id]/SpaceDetailView.tsx:538-556` 등 | 예약자/연락처 입력 2단이 360px 화면에서 좁음 | `grid-cols-1 sm:grid-cols-2` |
| 12 | `src/app/globals.css:67` | 모바일 본문 15px | 16px(`--fs-body`)로 올리고 캡션 13px 유지 |
| 13 | `src/app/globals.css:101` · `layout.tsx:70` | `antialiased`로 획이 얇아짐 | 두 곳 제거 |

### 참고 — 잘 된 점 (유지)

- `input/select/textarea { font-size: 16px }` (`globals.css:168-172`) → iOS 포커스 확대 방지 정상.
- 색 대비: `--ink #1B1624`(17.7:1), `--ink-soft #4F4757`(8.9:1), `--ink-mute #6F6879`(5.3:1), 브랜드 버튼 `#E01867`(4.7:1) — WCAG AA 충족.
- 가격·숫자 `tabular-nums` 적용, 하단 4탭 내비 + 안전영역 패딩, 상세 하단 고정 CTA.
- 예약 완료 후 **비로그인 예약 확인 링크**(`accessToken`)와 입금 카운트다운 — 손님 이탈 방지에 효과적.

---

## 4. 고객 동선 진단·개선안

### 지금 동선
`홈(검색어·지역·인원) → /search(카테고리 칩·지역·가격·인원·정렬) → /spaces/[id]` — 날짜 입력은 **상세 페이지 예약 폼에서 처음** 등장 → 예약 폼은 모바일에서 공간소개·시설·이용안내·호스트·비슷한 공간 **아래**에 위치(`SpaceDetailView.tsx:317`의 `<aside>`, 단일 열에서는 2번째) → 하단 고정 "예약하기"가 `#booking`으로 스크롤.

### 불편 포인트
| # | 지점 | 왜 불편한가 | 개선안 |
| --- | --- | --- | --- |
| C1 | 검색 전체에 **날짜 축 없음** (`lib/filter.ts` SpaceFilters: query/category/region/price/guests/sort) | 손님은 "언제 갈 수 있는지"가 1순위인데 날짜·시간대를 아예 못 고름 | 홈·검색에 `날짜`(오늘/내일/주말 칩 + date input) 추가. 선택 시 `get_occupied_slots`로 **그 날짜에 비어 있는 공간/시간대만** 노출 |
| C2 | 상세에서 예약 폼이 맨 아래 | 사진·소개를 다 읽어야 날짜를 고를 수 있음(하단 CTA로 완화되지만 계산은 안 됨) | 모바일에서 `aside`를 사진 바로 아래로(order), 또는 상단에 "날짜·시간 먼저 고르기" 미니 위젯 |
| C3 | 시간 선택이 **15개 옵션 select**(`TIME_SLOTS` 08~22시) | iOS 휠에서 스크롤 피로, 예약됨/차단 항목이 비활성으로만 표시 | 가로 스크롤 타임칩(09:00·10:00…)으로 바꾸고 예약·차단 칩은 취소선+회색. 선택 시 "18:00–20:00 · 4시간"처럼 소요시간까지 한 줄 표시 |
| C4 | 패키지 요금 없음(`HOUR_OPTIONS=[1,2,3,4,5,6,8]`만) | 파티룸·연습실의 실제 판매 단위는 "금요 올나잇 / 낮 4시간" | **스키마 변경 없이** 인기 조합 원탭 칩: `2시간`, `4시간(18–22시)`, `올나잇(22–08시)`. 단 `TIME_SLOTS`가 22시에서 끊겨 올나잇은 **슬롯 확장 필요**(아래 C5) |
| C5 | `lib/constants.ts:118` TIME_SLOTS 08~22시 | 자정 넘김 예약을 고를 수 없음(20시+8시간만 부분 지원) | 24시간 슬롯(예: 08~다음날 08시)으로 확장. `buildSlotStatuses`/`calcTotal`은 ms 기반이라 로직은 이미 자정 넘김 대응됨 |
| C6 | 폼에 **입금자명** 입력 없음 | 손님이 다른 이름으로 입금하면 사장님이 대조 불가 → 확정 지연 | "입금자명(다르면 입력)" 선택 필드 추가, 사장님 예약 카드에 함께 표시 |
| C7 | 예약 확정 알림이 이메일뿐 | 손님이 확정 시점을 모름(PWA 푸시 미구현) | 예약 확인 링크를 문자로도? → 최소한 `/bookings?token=` 링크를 카톡 공유 버튼으로 제공(`web share` 1탭) |
| C8 | `/pay/[slug]` 상단 `예약하기` 앵커만 있음 | 사장님 링크로 들어온 손님에게 폼이 화면 밖 | 상단 sticky 요약바(가격+날짜+예약 버튼)로 통일 |

---

## 5. 사장님 동선 진단·개선안

### 지금 동선
`/host` 5탭(대시보드·내 공간·예약 관리·시간 관리·결제 링크) → 예약 관리는 카드 목록 → 입금 확인/거절 → 결제 링크 탭에서 URL 복사·DM 문구 복사.

### 불편 포인트
| # | 지점 | 왜 불편한가 | 개선안 |
| --- | --- | --- | --- |
| H1 | `host/page.tsx:1220-1315` **QR 없음** (코드 전체 grep 결과 QR 생성 없음) | 매장·인스타 프로필·전단에 붙일 수단이 링크 텍스트뿐 | 공간 선택 시 **QR 이미지 즉시 생성 + PNG 저장**(클라이언트 라이브러리, 서버 불필요). `next/image` 대신 canvas로 |
| H2 | 같은 곳 `copy()`만 있고 **Web Share 없음**(`navigator.share`는 `InviteCard.tsx:466`에만) | 폰에서는 클립보드 복사 후 카톡 열어 붙여넣기 3단계 | "카톡·인스타로 보내기" 버튼 = `navigator.share({text, url})`, 미지원 시 복사 폴백 |
| H3 | 예약 관리 카드 액션 11px/28px (`:955-975`) | 장갑 낀 손, 밝은 야외에서 오탭 | 44px 버튼 2개(확정/거절), 카드 상단에 "입금 대기" 뱃지 강조 |
| H4 | 탭 5개가 `overflow-x-auto` (`:572`) | 360px 폰에서 "결제 링크" 탭이 화면 밖 → 발견성 낮음 | 하단 5탭 내비(아이콘+12px)로 승격하거나, 대시보드에 큰 진입 카드 3개(예약/시간/링크) |
| H5 | 대시보드 지표가 10~11px 라벨 (`:602-620`) | 폰에서 숫자만 보이고 의미가 안 읽힘 | 라벨 12px, 숫자 24→28px, "이번 달 예상 매출"은 카드 전체를 브랜드 배경으로 |
| H6 | 예약 승인 시 **입금자명 대조 정보 없음**(`DepositInfoRow.tsx`) | 통장 거래내역과 예약자를 맞출 수 없음 | C6의 입금자명 + 금액을 한 줄에 크게: `38,250원 · 김OO` |
| H7 | 신규 예약 알림이 이메일(Resend)만 | 폰에서 바로 반응하기 어려움 | (Phase 3) 웹푸시 또는 알림톡. 그 전까지 대시보드 상단 "대기 N건" 배너 → 예약 탭 원탭 |
| H8 | 공간 등록 모달이 필드 20여 개 단일 스크롤(`:1330-1690`) | 3분 등록이 실제로는 10분 | 3단계로 분할(기본정보 → 사진 → 요금·계좌), 각 단계 상단 진행 표시 |
| H9 | 계좌 미등록 상태에서 예약이 들어옴 | 손님에게 "계좌 미등록" 안내가 뜸(`DepositGuide.tsx:189`) | 계좌 미등록 공간은 **공개 전 경고 + 등록 유도 배너**, 대시보드에 "계좌 등록 필요 N곳" |

---

## 6. 우선순위와 공수 (제안)

| 순위 | 묶음 | 내용 | 예상 |
| --- | --- | --- | --- |
| 1 | **폰트·확대·최소 글자** | 2장 전체 + 3장 P0 5건 | 반나절 |
| 2 | **사장님 결제 링크** | H1(QR) + H2(Web Share) + H3(버튼 크기) | 반나절 |
| 3 | **고객 날짜 동선** | C1(날짜 필터) + C3(타임칩) + C4(원탭 조합) | 1~2일 |
| 4 | **예약 카드 정보** | C6(입금자명) + H6 + H5 | 반나절 |
| 5 | **터치·밀도 정리** | 3장 P1 6~13 | 반나절 |
| 6 | Phase 3 | 올나잇 슬롯 확장(C5), 웹푸시(H7), 후기·찜 | 별도 |

---

## 7. 이번 작업에서 하지 않은 것

- 앱 코드·설정 수정 없음. GitHub push·Vercel 배포 없음.
- 추가한 파일은 `public/fonts/pretendard-static/`(폰트 5종 + OFL) 와 `docs/font-static/pretendard-static-fontface.css`, 이 문서뿐입니다(커밋 전 상태).
- 아이폰 Safari 실기기 검증은 이 환경에서 불가능해 **미확인**으로 남겼습니다.
