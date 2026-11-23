/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 로컬 디버깅용 빌드 산출물 경로 (기본값 .next, 배포에는 영향 없음)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // 폰트는 내용이 바뀌지 않는 정적 자산이라 1년 캐시를 붙인다(재방문 시 폰트 재검증 0회).
  // 폰트 파일을 갱신할 때는 파일명을 바꿔 올려야 한다(예: Pretendard-Regular.v2.subset.woff2).
  async headers() {
    return [
      {
        source: "/fonts/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
  // 공유 카드(opengraph-image)가 서버에서 직접 읽는 한글 폰트를 서버리스 번들에 포함한다.
  outputFileTracingIncludes: {
    "/spaces/[id]/opengraph-image": ["./src/assets/fonts/**"],
    "/pay/[slug]/opengraph-image": ["./src/assets/fonts/**"],
  },
};

export default nextConfig;
