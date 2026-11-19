import { fetchPublicSpaceBySlug } from "@/lib/server-data";
import { renderShareCard } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "이곳저곳 예약 공유 카드";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** /pay/[slug]/opengraph-image — 전용 결제 링크 공유용 동적 이미지 */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const space = await fetchPublicSpaceBySlug(slug);

  if (!space) {
    return new Response("Not found", { status: 404 });
  }

  return renderShareCard({
    title: space.name,
    photoUrl: space.imageUrls?.[0] ?? space.imageUrl ?? null,
    space,
    kind: "pay",
  });
}
