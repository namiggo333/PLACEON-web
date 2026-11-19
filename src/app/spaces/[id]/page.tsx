import type { Metadata } from "next";
import SpaceDetailView from "./SpaceDetailView";
import { fetchPublicSpaceById } from "@/lib/server-data";
import { NOINDEX, SITE_NAME, spaceMetadata } from "@/lib/seo";

type Params = { id: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const space = await fetchPublicSpaceById(id);
  if (!space) {
    // 미승인·비공개·없는 공간은 검색·공유 카드에 노출하지 않는다.
    return { title: `공간을 찾을 수 없어요 | ${SITE_NAME}`, robots: NOINDEX };
  }
  return spaceMetadata(space);
}

export default async function Page({ params }: { params: Promise<Params> }) {
  // 클라이언트 화면은 기존과 동일하게 AppProvider 데이터를 쓴다(상세 렌더·예약 흐름).
  await params;
  return <SpaceDetailView />;
}
