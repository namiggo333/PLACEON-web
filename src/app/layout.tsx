import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProvider } from "@/components/AppProvider";
import { Chrome } from "@/components/Chrome";

export const metadata: Metadata = {
  title: "플레이스온 PlaceOn · 공간 예약부터 결제까지",
  description:
    "시간 단위로 빌리는 모든 공간. 파티룸·연습실·촬영스튜디오·회의실·공유주방·루프탑·스터디룸을 한 번에 찾고, 1초 만에 예약하고 결제하세요.",
  applicationName: "플레이스온",
  keywords: ["공간대여", "파티룸", "연습실", "촬영스튜디오", "회의실", "공유주방", "루프탑", "스터디룸", "플레이스온"],
  openGraph: {
    title: "플레이스온 PlaceOn",
    description: "시간 단위로 빌리는 모든 공간, 예약부터 결제까지 1초 만에.",
    type: "website",
    locale: "ko_KR",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#E31C79",
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
      </body>
    </html>
  );
}
