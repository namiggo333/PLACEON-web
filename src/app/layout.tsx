import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProvider } from "@/components/AppProvider";
import { Chrome } from "@/components/Chrome";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

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
  themeColor: "#FF6B00",
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
