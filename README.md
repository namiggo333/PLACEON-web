# 이곳저곳 🩷

> 시간 단위로 빌리는 모든 공간 — 예약부터 결제·광고까지 한 곳에서.
> 공간대여 사장님을 위한 **결제 + 광고 통합 플랫폼**의 실제 동작하는 PC·모바일 반응형 웹앱입니다.

- **브랜드**: 이곳저곳 (공간대여 예약·결제·광고 통합 플랫폼)
- **메인 컬러**: 팬톤 핫핑크 `#E31C79` / 호버 `#DA1884` / 배경 포인트 `#FDF2F8`
- **UI 레퍼런스**: 야놀자 스타일의 카드형 검색·카테고리·타임특가·즉시예약 UI
- **기술 스택**: Next.js 15 (App Router, TypeScript) · Tailwind CSS · Supabase(선택)
- **저장소**: https://github.com/namiggo333/PLACEON-web (public)

![PC 홈](docs/preview/home-desktop.png)

| 모바일 홈 | 사장님 센터 |
| --- | --- |
| ![모바일 홈](docs/preview/home-mobile.png) | ![사장님 센터](docs/preview/host-dashboard.png) |

| 전용 결제 링크 페이지 (모바일) |
| --- |
| ![결제 링크](docs/preview/pay-mobile.png) |

---

## 1. 계정 안내

| 구분 | 이메일 | 비밀번호 |
| --- | --- | --- |
| 게스트(샘플) | `guest@placeon.kr` | `placeon1234` |
| 사장님(샘플) | `host@placeon.kr` | `placeon1234` |

> 실제 서비스는 이메일로 회원가입한 본인 계정으로 사용합니다(게스트/사장님 선택).
> 위 샘플 계정은 Supabase를 연결하지 않은 **미리보기 모드**(localStorage)에서만 자동 생성되며, 계정·공간·예약이 그 브라우저에만 저장됩니다.

---

## 2. 구현된 페이지 & 기능

| 경로 | 화면 | 핵심 기능 |
| --- | --- | --- |
| `/` | 홈 (게스트) | 통합 검색(지역·공간명·키워드·인원), 8개 카테고리 필터, 오늘의 공실 타임특가 + 실시간 카운트다운, 지역/가격대/정렬 필터, 실시간 예약 가능 카드 리스트 |
| `/search` | 공간 찾기 | 키워드·카테고리·지역·가격대·인원·정렬 필터, 결과 개수·초기화, 모바일 앱형 필터 바 |
| `/spaces/[id]` | 공간 상세 | 사진 갤러리(대표 + 추가 사진), 공간 소개·시설·이용 안내·호스트 정보, 날짜/시작시간/이용시간/인원 선택 → **실시간 총액 계산**(타임특가 자동 적용) → 예약 신청, 예약 확정 안내 + 호스트 전용 예약 링크 |
| `/bookings` | 예약 내역 | 전체/대기중/확정/취소 탭, **입금 계좌·금액·15분 기한 안내와 실시간 남은 시간**, 예약 취소, 결제 링크 예약 표시, 요청사항·연락처·금액 확인, **확정 예약의 `💌 모임 초대 카드`(초대 문구 복사 · 1080×1350 카드 이미지 저장 · Web Share 공유)** |
| `/auth` | 로그인 / 회원가입 | 이메일·비밀번호, 게스트/사장님 역할 선택 |
| `/host` | 사장님 센터 | 대시보드(이번 달 예상 매출·접수 예약·노출 공간·링크 유입), 내 공간 **등록/수정/삭제**, **입금 계좌(은행·계좌번호·예금주) 등록**, **공간 사진 실제 파일 업로드(최대 6장, 대표 사진 지정)**, **공개/비공개 전환**, 예약 **입금 확인(확정)/거절/취소**, 공실 광고 ON/OFF, 타임특가 ON/OFF, **전용 예약 링크 생성·복사·DM 문구 복사** |
| `/pay/[slug]` | 전용 예약 페이지 (미니 예약 홈페이지) | 사장님이 인스타 프로필·카톡 상담에 걸어 두는 손님용 페이지. **대표 사진 갤러리(썸네일·넘겨보기)**, 카테고리·타임특가 배지, 위치(지도 링크)·수용인원·평점, 시간당 요금(할인가·원가), 공간 소개·편의시설·사장님 안내, 3단계 예약 절차, **바로 이어지는 날짜/시간 예약 폼**(오늘·내일·모레 빠른 선택, 금액 자동 계산). 로그인 없이 접수, `수수료 0원 · 전용 예약 페이지` 브랜딩 |
| `/admin` | 총괄 관리자 | 관리자 전용. 전체 공간 요약(공개/비공개)·예약 건수·예약 금액·회원 수, **입점 공간 관리**(검색·카테고리 필터, 공개/비공개·상단 광고·타임특가 스위치, 삭제), **예약 현황**(전체 예약·상태 변경), **입점 사장님·회원 목록** |

### 디자인 · 폰트

- **주아체(Jua)** — 로고 워드마크·히어로·제목·카테고리 라벨·주요 CTA·배지·가격 숫자 등 포인트 요소
- **나눔스퀘어라운드** — 본문·작은 글씨 기본 폰트(가독성 유지)
- 두 폰트 모두 `public/fonts/`에 셀프호스팅합니다. 주아체는 Next의 `next/font/google`이 한글 서브셋을 노출하지 않아(`latin`만 허용) 한글이 고딕으로 떨어지는 문제가 있어, 같은 구글 웹폰트를 유니코드 슬라이스 그대로 받아 `src/app/jua-fontface.css`에서 `@font-face`로 선언했습니다(브라우저는 필요한 조각만 내려받습니다).

### 동작하는 상태 관리

- 회원가입 → 로그인 → 세션 유지
- 공간 등록/수정/삭제 → 홈·검색·상세에 즉시 반영
- 예약 신청 → **입금 대기(pending, 15분)** → 사장님 [입금 확인] → 확정 → 게스트 예약 내역 상태 변경
- **새 예약 접수 시 사장님 이메일 알림**(Resend/Brevo), 주요 상태 변화(손님 취소 등)도 알림
- **15분 안에 입금이 확인되지 않은 예약은 pg_cron 이 1분마다 자동 취소** → 그 시간대는 다시 예약 가능
- 타임특가·상단 노출 광고 토글 → 홈 특가 섹션·카드 AD 배지에 즉시 반영
- **공간 사진 업로드 → Supabase Storage(`space-images`)에 저장 → 카드·상세 갤러리에 즉시 반영**
- **공개/비공개 전환 → 비공개 공간은 손님 홈·검색에서 빠지고 사장님 센터에만 남음**
- 결제 링크 생성 → `/pay/[slug]`에서 실제 예약 접수 (비로그인 손님 포함)
- **총괄 관리자 → 전체 공간·예약·회원 조회 및 공개/광고/삭제·예약 상태 변경 (관리자 계정만)**

### 총괄 관리자(`/admin`) 권한

- 관리자 이메일: `namiggo333@gmail.com` (`src/lib/admin.ts`). 이 계정으로 로그인했을 때만 헤더에 `관리자` 링크가 보이고 `/admin` 화면이 열립니다.
- 비로그인·일반 회원이 `/admin`에 들어가면 접근 제한 화면이 나옵니다.
- 화면 제한과 별개로 **Supabase RLS**가 서버에서 다시 막습니다: `public.admins` 명단 + `public.is_admin()` 함수, 그리고 `profiles_select_admin` / `spaces_update_admin` / `spaces_delete_admin` / `bookings_select_admin` / `bookings_update_admin` 정책.
- `public.admins` 테이블은 조회 정책을 두지 않고 anon/authenticated 권한을 회수해, 관리자 이메일 명단이 외부에 노출되지 않습니다.

---

## 3. 로컬 실행

```bash
cd placeon-web
npm install
npm run dev        # http://localhost:3000
```

프로덕션 빌드 검증:

```bash
npm run build
npm start
```

> Node.js 20 이상을 권장합니다.

---

## 4. 무료 배포: Vercel + Supabase 3단계

### ① Supabase 준비 (5분)

1. [supabase.com](https://supabase.com) → **New project** (무료 플랜)
2. 좌측 **SQL Editor** → `supabase/schema.sql` 내용을 전체 붙여넣고 **Run**
   - `profiles`, `spaces`, `bookings` 테이블 / RLS 정책 / 회원가입 자동 프로필 트리거 / 샘플 공간 4개 생성
   - **Storage `space-images` 공개 버킷 + 사진 읽기/업로드/삭제 정책**도 함께 생성됩니다
3. **Project Settings → API** 에서 두 값을 복사
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

> `anon key`는 공개되어도 되는 키입니다(RLS로 보호). `service_role` 키는 절대 브라우저에 넣지 마세요.

### ② Vercel 배포 (2분)

1. [vercel.com](https://vercel.com) → **Add New → Project**
2. 이 GitHub 저장소(`namiggo333/PLACEON-web`)를 **Import** — Framework는 Next.js로 자동 인식됩니다.
3. **Environment Variables** 에 위 두 값을 추가 → **Deploy**

### ③ 배포 후

- 환경변수를 넣으면 자동으로 **Supabase 모드**로 전환됩니다. (넣지 않으면 브라우저 저장소를 쓰는 미리보기 모드)
- Supabase **Authentication → Providers → Email** 에서 이메일 인증을 끄면 가입 즉시 로그인되어 테스트가 편해요.
- 배포 도메인에서 회원가입 → 공간 등록 → 예약 → 승인 → 결제 링크 순서로 바로 확인할 수 있습니다.

### 환경변수

```bash
# placeon-web/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

`.env.local`은 `.gitignore`에 포함되어 있어 커밋되지 않습니다. 실제 키를 코드나 저장소에 올리지 마세요.

---

## 5. 미리보기 모드 vs Supabase 모드

| | 미리보기 모드 (환경변수 없음) | Supabase 모드 |
| --- | --- | --- |
| 데이터 저장 | 브라우저 localStorage | Supabase Postgres |
| 계정 | 브라우저 안에서만 | 실제 이메일 계정 |
| 공간 사진 | 브라우저에 압축 저장(DataURL) | Supabase Storage 업로드 |
| 예약 링크 공유 | 만든 브라우저에서만 열림 | 손님 기기에서도 열림 |
| 배포 후 테스트 | 즉시 가능 (0원) | 프로젝트 생성 후 가능 (무료 플랜) |

코드는 두 모드를 같은 인터페이스(`src/lib/db.ts`)로 처리합니다. 환경변수가 있으면 자동으로 Supabase Auth/DB를 사용합니다.

---

## 6. 폴더 구조

```
placeon-web/
├─ src/
│  ├─ app/
│  │  ├─ page.tsx              # 홈
│  │  ├─ search/page.tsx       # 공간 찾기
│  │  ├─ spaces/[id]/page.tsx  # 공간 상세·예약
│  │  ├─ bookings/page.tsx     # 예약 내역
│  │  ├─ auth/page.tsx         # 로그인·회원가입
│  │  ├─ host/page.tsx         # 사장님 센터
│  │  ├─ admin/page.tsx        # 총괄 관리자(/admin)
│  │  └─ pay/[slug]/page.tsx   # 전용 간편 결제 링크
│  ├─ components/              # AppProvider, 헤더/하단탭, 카드, 필터 등
│  └─ lib/                     # 타입, Supabase/로컬 저장소, 시드, 포맷, 관리자 권한(admin.ts)
├─ supabase/schema.sql         # 테이블·RLS·트리거·샘플 데이터
├─ docs/preview/               # 화면 캡처
└─ .env.example
```

---

## 7. 검증 결과

- `npm install` 완료 (Next.js 15.5.29, React 19, Tailwind 3.4)
- `npm run build` **성공** — TypeScript 타입 검사 및 프로덕션 빌드 통과
- 9개 라우트 생성 확인 (`/`, `/search`, `/spaces/[id]`, `/bookings`, `/auth`, `/host`, `/pay/[slug]`, `/icon.svg`, `/_not-found`)
- 실제 브라우저(Chromium 390px 모바일 / 1440px 데스크톱) 자동 테스트로 아래 흐름 검증
  - 게스트 로그인 → 예약 신청 → 예약 내역 표시
  - 사장님 로그인 → 공간 등록 → 예약 승인 → 상태 변경
  - **공간 사진 2장 업로드 → Storage 저장·미리보기·카드/갤러리 반영 → 공간 삭제 시 사진 파일까지 정리 확인**
  - **비공개 전환 → 손님 홈·검색에서 제외 확인**
  - 전용 결제 링크 생성 → `/pay/[slug]` 비로그인 예약 접수
  - 콘솔 에러 0건

---

## 8. 입금 확인·알림·만료 정리 (1단계)

PG 계약 전에도 실제 거래가 끝까지 돌아가도록 만든 1단계 기능입니다.

### 흐름

1. 손님이 예약을 신청하면 **`pending`(입금 대기)** 으로 접수되고 `expires_at`(15분 뒤)이 함께 기록됩니다.
2. 접수 화면과 `/bookings` 에 **입금 계좌(은행·계좌번호·예금주), 입금 금액, 입금 기한**과 남은 시간이 표시됩니다.
3. 사장님 센터(`/host`)·총괄 관리자(`/admin`)의 예약 목록에서 **[입금 확인(확정)]** 을 누르면 `confirmed` 로 바뀌고 만료 대상에서 빠집니다. **[예약 거절]** 은 `cancelled` 로 바꿔 그 시간대를 바로 풀어 줍니다.
4. 15분 안에 확인되지 않은 예약은 **자동으로 `cancelled`(사유 `expired`)** 처리되고 손님 예약 내역에는 `기한만료` 로 표시됩니다.

### DB

- `public.space_accounts` — 공간별 입금 계좌. `spaces` 는 누구나 조회할 수 있으므로 계좌는 별도 테이블에 두고 RLS 로 **사장님 본인·총괄 관리자만** 읽게 했습니다.
- `public.bookings.pay_bank_name / pay_account_number / pay_account_holder` — 예약 접수 시점의 계좌 스냅샷. 손님은 자기 예약 행에서만 볼 수 있습니다.
- `public.bookings.cancel_reason` — `expired`(15분 미입금) / `host`(사장님 거절·취소) / `guest`(손님 취소)
- `public.expire_pending_bookings()` + **pg_cron 1분 스케줄**(`expire-pending-bookings`) — 기한이 지난 `pending` 을 정리. `bookings_no_overlap` 은 `pending/confirmed` 만 잡으므로 취소 즉시 같은 시간대가 다시 열립니다.

### 알림 메일

- 새 예약 → 해당 공간 사장님 메일로 **공간명·날짜/시간·인원·예약자명·연락처·금액·입금 기한·`/host` 링크** 발송.
- 손님 취소·관리자 상태 변경도 사장님께 알림(사장님이 직접 누른 처리는 되돌림 메일을 보내지 않음).
- 발송 실패는 예약 API 응답을 실패시키지 않습니다(로그만 남김).
- 무료 발송: `RESEND_API_KEY`(100통/일) 또는 `BREVO_API_KEY`(300통/일). 자세한 환경변수는 `.env.example` 참고.
  - Resend 무료 플랜은 도메인 인증 전 `onboarding@resend.dev` 로 **계정 소유자 주소에만** 발송됩니다. 여러 사장님께 보내려면 Resend 에서 도메인을 인증하고 `MAIL_FROM` 을 바꿔 주세요.

### 수동 점검

```bash
curl -s https://igotjeogot.vercel.app/api/cron/expire-bookings   # 만료 정리 1회 실행
```

`CRON_SECRET` 을 설정하면 `Authorization: Bearer <secret>` 또는 `?key=<secret>` 이 필요합니다.

---

## 9. 다음 단계 (실서비스 전 체크)

- **실제 결제**: 토스페이먼츠·포트원(PG) 연동 + 정산 계좌/세금계산서
- **알림**: 예약 접수·확정 시 알림톡(카카오 비즈) 또는 문자
- **이미지 업로드**: 완료 (Supabase Storage `space-images`, 최대 6장, 자동 압축·대표 사진 지정)
- **보안 강화**: 예약 금액·상태 변경을 Supabase RPC(Edge Function)에서 서버 검증
- **정산 자동화**: 월별 정산 리포트, 수수료 정책(현재 무료 0% 단계)
- **본인 인증**: 사장님 계좌·사업자 정보 확인

---

© 2026 이곳저곳. 공간대여 예약·결제·광고 통합 플랫폼.
