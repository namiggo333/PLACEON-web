import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CATEGORIES, CATEGORY_MAP } from "@/lib/constants";
import { fetchPublicSpaces } from "@/lib/server-data";
import { NOINDEX, SITE_NAME, SITE_URL, categoryFromSlug, regionFromSlug, regionSlug } from "@/lib/seo";
import { SpaceCard } from "@/components/SpaceCard";

export const revalidate = 600;

type Params = { region: string; category: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { region: regionSlugParam, category: categoryParam } = await params;
  const region = regionFromSlug(regionSlugParam);
  const category = categoryFromSlug(categoryParam);
  if (!region || !category) return { title: `페이지를 찾을 수 없어요 | ${SITE_NAME}`, robots: NOINDEX };

  const label = CATEGORY_MAP[category].label;
  const spaces = await fetchPublicSpaces();
  const matched = spaces.filter((space) => space.region === region && space.category === category);
  const title = `${region} ${label} 대여 · 시간 단위 예약 | ${SITE_NAME}`;
  const description =
    matched.length > 0
      ? `${region} ${label} ${matched.length}곳을 시간 단위로 비교하고 바로 예약하세요. 사진·가격·예약 가능 시간까지 한 화면에.`
      : `${region} ${label} 공간을 준비하고 있어요. 가까운 다른 카테고리나 지역에서 예약 가능한 공간을 찾아보세요.`;
  const url = `${SITE_URL}/areas/${regionSlugParam}/${categoryParam}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", locale: "ko_KR", siteName: SITE_NAME },
    // 승인 공간이 하나도 없는 조합은 색인하지 않는다(빈 페이지가 검색에 걸리지 않도록).
    robots: matched.length === 0 ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function RegionCategoryPage({ params }: { params: Promise<Params> }) {
  const { region: regionSlugParam, category: categoryParam } = await params;
  const region = regionFromSlug(regionSlugParam);
  const category = categoryFromSlug(categoryParam);
  if (!region || !category) notFound();

  const label = CATEGORY_MAP[category].label;
  const spaces = await fetchPublicSpaces();
  const matched = spaces
    .filter((space) => space.region === region && space.category === category)
    .sort((a, b) => Number(b.featured) - Number(a.featured) || a.pricePerHour - b.pricePerHour);
  const regionSlugValue = regionSlug(region);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="text-[11px] text-ink-mute">
        <Link href="/areas" className="hover:text-brand">
          지역별 찾기
        </Link>
        <span className="mx-1">›</span>
        <Link href={`/areas/${regionSlugValue}`} className="hover:text-brand">
          {region}
        </Link>
        <span className="mx-1">›</span>
        <span className="font-bold text-ink-soft">{label}</span>
      </nav>

      <h1 className="mt-2 text-2xl font-black text-ink">
        {region} {label} <span className="text-brand">{matched.length}</span>
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        {matched.length > 0
          ? `${region}에서 ${label}으로 예약할 수 있는 공간이에요. 시간 단위로 고르고, 예약·입금 안내를 한 번에 받아 보세요.`
          : `${region} ${label} 공간은 아직 준비 중이에요. 다른 카테고리나 가까운 지역을 확인해 보세요.`}
      </p>

      {matched.length > 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {matched.map((space) => (
            <SpaceCard key={space.id} space={space} />
          ))}
        </div>
      ) : (
        <div className="card mt-6 p-8 text-center">
          <p className="text-sm font-bold text-ink">이 조합에는 아직 공개된 공간이 없어요</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link href={`/areas/${regionSlugValue}`} className="btn-soft btn-sm">
              {region} 전체 보기
            </Link>
            <Link href="/search" className="btn-primary btn-sm">
              전체 공간 보기
            </Link>
          </div>
        </div>
      )}

      <h2 className="mt-10 text-sm font-extrabold text-ink">{region}의 다른 카테고리</h2>
      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
        {CATEGORIES.filter((item) => item.key !== category).map((item) => (
          <Link
            key={item.key}
            href={`/areas/${regionSlugValue}/${item.key}`}
            className="rounded-full border border-ink-line bg-white px-3 py-1.5 font-semibold text-ink-soft hover:border-brand hover:text-brand"
          >
            {item.emoji} {region} {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
