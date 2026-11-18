import HomeView from "@/components/HomeView";
import { fetchPublicSpaces } from "@/lib/server-data";

/*
 * 홈은 서버에서 공간 목록을 먼저 받아 HTML 과 함께 내려준다.
 * - 첫 방문에도 '불러오는 중' 스켈레톤 없이 바로 목록이 보인다.
 * - 60초마다 백그라운드에서 갱신(ISR)하고, 공간 등록·수정·삭제 시
 *   /api/revalidate 로 즉시 무효화한다.
 */
export const revalidate = 60;

export default async function HomePage() {
  const spaces = await fetchPublicSpaces();

  return <HomeView initialSpaces={spaces} />;
}
