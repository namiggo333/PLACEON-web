import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * robots.txt — 손님 화면(홈·검색·공간·동네 랜딩·전용 예약 링크)만 색인 허용.
 * 사장님 센터·관리자·예약 내역·로그인·API 는 제외한다.
 * (전용 예약 링크는 카톡·인스타 공유 미리보기가 이미지를 가져가야 해서 막지 않는다)
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/host", "/admin", "/bookings", "/auth", "/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
