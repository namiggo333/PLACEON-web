import { fetchPublicSpaceById } from "@/lib/server-data";
import { renderShareCard } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "이곳저곳 공간 공유 카드";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** /spaces/[id]/opengraph-image — 카톡·인스타 공유용 동적 이미지 */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const space = await fetchPublicSpaceById(id);

  // 승인되지 않았거나 없는 공간은 OG 이미지를 만들지 않는다(정보 노출 차단).
  if (!space) {
    return new Response("Not found", { status: 404 });
  }

  return renderShareCard({
    title: space.name,
    photoUrl: space.imageUrls?.[0] ?? space.imageUrl ?? null,
    space,
    kind: "space",
  });
}
