/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 로컬 디버깅용 빌드 산출물 경로 (기본값 .next, 배포에는 영향 없음)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
