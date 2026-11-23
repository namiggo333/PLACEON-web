import type { Metadata, Viewport } from "next";
import "./pretendard-static-fontface.css";
import "./jua-fontface.css";
import "./globals.css";
import "./ui-tokens.css";
import { AppProvider } from "@/components/AppProvider";
import { Chrome } from "@/components/Chrome";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { SITE_URL } from "@/lib/site-url";

/** 폰트 로딩
 *  - 본문·제목·버튼: Pretendard 정적 5종(400/500/600/700/800, pretendard-static-fontface.css).
 *    가변 폰트를 92조각 unicode-range 로 쪼개 쓰던 방식에서는 Chromium 이 굵기 축을
 *    적용하지 못해 모든 글자가 400 으로 그려지는 현상이 실측 확인되어(2026-11-23)
 *    웨이트별 별도 파일로 교체했다. /fonts/* 는 next.config.mjs 에서 1년 캐시.
 *  - 브랜드 포인트(로고 워드마크·초대 카드): 주아체(jua-fontface.css).
 *    주아체는 Next의 next/font/google 메타데이터에 한글 서브셋이 없어(Korean
 *    유니코드 슬라이스가 latin으로만 노출) 한글이 fallback으로 떨어지므로,
 *    같은 Google 웹폰트를 유니코드 슬라이스 그대로 셀프호스팅했다. */
const SITE_TITLE = "이곳저곳 · 공간 예약부터 결제까지";
const SITE_DESCRIPTION =
  "시간 단위로 빌리는 모든 공간. 파티룸·키즈룸·연습실·촬영스튜디오·회의실·공유주방·루프탑·스터디룸을 한 번에 찾고, 날짜·시간만 고르면 예약 요청이 끝납니다. 입금을 확인하면 예약이 확정돼요.";

export const metadata: Metadata = {
  // 상대 경로 canonical·OG 이미지가 대표 도메인(https://igotjeogot.com) 기준으로 만들어진다.
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: "이곳저곳",
  keywords: ["공간대여", "파티룸", "키즈룸", "연습실", "촬영스튜디오", "회의실", "공유주방", "루프탑", "스터디룸", "이곳저곳"],
  openGraph: {
    title: "이곳저곳",
    description: "시간 단위로 빌리는 모든 공간. 날짜·시간만 고르면 예약 요청 끝, 입금하면 확정.",
    type: "website",
    locale: "ko_KR",
    siteName: "이곳저곳",
  },
  // 홈 화면에 추가(PWA) 관련 설정
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "이곳저곳",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: { telephone: false, email: false, address: false },
  // iOS 사파리 홈 화면 추가용 레거시 메타 (appleWebApp이 만드는 표준 태그와 함께 내보낸다)
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // maximumScale 을 두면 모바일에서 확대(pinch zoom)가 막혀 작은 글씨를 키울 수 없다.
  // 접근성(WCAG 1.4.4)에도 어긋나므로 해제한다. (iOS 입력창 자동 확대는
  // globals.css 의 input/select/textarea 16px 로 이미 막혀 있다)
  viewportFit: "cover",
  themeColor: "#FF2E7E",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        {/* 첫 화면에서 가장 많이 쓰는 400 만 미리 받아 굵기 깜빡임을 줄인다. */}
        <link
          rel="preload"
          href="/fonts/pretendard-static/Pretendard-Regular.subset.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-dvh bg-white font-sans text-ink">
        <AppProvider>
          <Chrome>{children}</Chrome>
        </AppProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
