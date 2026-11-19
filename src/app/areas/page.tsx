import Link from "next/link";
import type { Metadata } from "next";
import { CATEGORIES } from "@/lib/constants";
import { fetchPublicSpaces } from "@/lib/server-data";
import { ALL_REGIONS, REGION_SLUGS, SITE_NAME, SITE_URL } from "@/lib/seo";
import { SpaceCard } from "@/components/SpaceCard";

export const revalidate = 600;

export const metadata: Metadata = {
  title: `지역별 공간대여 찾기 | ${SITE_NAME}`,
  description:
    "서울·경기·부산·경남 등 전국 지역별 파티룸·키즈룸·연습실·촬영스튜디오·회의실을 한눈에. 이곳저곳에서 시간 단위로 예약하세요.",
  alternates: { canonical: `${SITE_URL}/areas` },
};

export default async function AreasIndexPage() {
  const spaces = await fetchPublicSpaces();
  const counts = new Map<string, number>();
  for (const space of spaces) counts.set(space.region, (counts.get(space.region) ?? 0) + 1);

  const regions = ALL_REGIONS.map((region) => ({
    region,
    slug: REGION_SLUGS[region],
    count: counts.get(region) ?? 0,
  })).sort((a, b) => b.count - a.count);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <p className="text-[11px] font-bold text-brand">지역별 공간 찾기</p>
      <h1 className="mt-1 text-2xl font-black text-ink">어느 동네에서 모일까요?</h1>
      <p className="mt-2 text-sm text-ink-soft">
        지역을 고르면 그 동네에서 지금 예약할 수 있는 공간과 카테고리별 모음이 나옵니다.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {regions.map((item) => (
          <Link
            key={item.region}
            href={`/areas/${item.slug}`}
            className="card flex items-center justify-between p-4 transition hover:border-brand/40"
          >
            <span className="text-sm font-extrabold text-ink">{item.region}</span>
            <span className="text-[11px] font-bold text-brand">
              {item.count > 0 ? `${item.count}곳` : "준비 중"}
            </span>
          </Link>
        ))}
      </div>

      <h2 className="mt-10 text-lg font-extrabold text-ink">카테고리로 찾기</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {CATEGORIES.map((category) => (
          <Link
            key={category.key}
            href={`/search?category=${category.key}`}
            className="rounded-full border border-ink-line bg-white px-3.5 py-2 text-xs font-bold text-ink-soft hover:border-brand hover:text-brand"
          >
            {category.emoji} {category.label}
          </Link>
        ))}
      </div>

      {spaces.length > 0 && (
        <>
          <h2 className="mt-10 text-lg font-extrabold text-ink">지금 예약할 수 있는 공간</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {spaces.slice(0, 6).map((space) => (
              <SpaceCard key={space.id} space={space} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
