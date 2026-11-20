import type { Metadata, Viewport } from "next";
import "./pretendard-fontface.css";
import "./jua-fontface.css";
import "./globals.css";
import { AppProvider } from "@/components/AppProvider";
import { Chrome } from "@/components/Chrome";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

/** 폰트 로딩
 *  - 본문·제목·버튼: Pretendard Variable(dynamic subset, pretendard-fontface.css).
 *    필요한 유니코드 조각만 받아 오고, 첫 화면에서 한글이 늦게 뜨지 않도록 swap 한다.
 *  - 브랜드 포인트(로고 워드마크·초대 카드): 주아체(jua-fontface.css).
 *    주아체는 Next의 next/font/google 메타데이터에 한글 서브셋이 없어(Korean
 *    유니코드 슬라이스가 latin으로만 노출) 한글이 fallback으로 떨어지므로,
 *    같은 Google 웹폰트를 유니코드 슬라이스 그대로 셀프호스팅했다. */
const SITE_TITLE = "이곳저곳 · 공간 예약부터 결제까지";
const SITE_DESCRIPTION =
  "시간 단위로 빌리는 모든 공간. 파티룸·키즈룸·연습실·촬영스튜디오·회의실·공유주방·루프탑·스터디룸을 한 번에 찾고, 1초 만에 예약하고 결제하세요.";

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: "이곳저곳",
  keywords: ["공간대여", "파티룸", "키즈룸", "연습실", "촬영스튜디오", "회의실", "공유주방", "루프탑", "스터디룸", "이곳저곳"],
  openGraph: {
    title: "이곳저곳",
    description: "시간 단위로 빌리는 모든 공간, 예약부터 결제까지 1초 만에.",
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
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#FF2E7E",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="min-h-dvh bg-white font-sans text-ink antialiased">
        <AppProvider>
          <Chrome>{children}</Chrome>
        </AppProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
