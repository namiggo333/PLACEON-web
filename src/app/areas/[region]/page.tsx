import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CATEGORIES, CATEGORY_MAP } from "@/lib/constants";
import { fetchPublicSpaces } from "@/lib/server-data";
import { NOINDEX, SITE_NAME, SITE_URL, areaLabel, regionFromSlug, regionSlug } from "@/lib/seo";
import { SpaceCard } from "@/components/SpaceCard";

export const revalidate = 600;

type Params = { region: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { region: slug } = await params;
  const region = regionFromSlug(slug);
  if (!region) return { title: `지역을 찾을 수 없어요 | ${SITE_NAME}`, robots: NOINDEX };

  const spaces = await fetchPublicSpaces();
  const inRegion = spaces.filter((space) => space.region === region);
  const title = `${region} 공간대여 · 파티룸·키즈룸·연습실 시간 단위 예약 | ${SITE_NAME}`;
  const description = `${region}에서 지금 예약할 수 있는 공간 ${inRegion.length}곳. 파티룸·키즈룸·연습실·촬영스튜디오·회의실을 시간 단위로 비교하고 바로 예약하세요.`;
  const url = `${SITE_URL}/areas/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", locale: "ko_KR", siteName: SITE_NAME },
    // 승인된 공간이 없는 지역은 빈 페이지를 색인하지 않는다.
    robots: inRegion.length === 0 ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function RegionLandingPage({ params }: { params: Promise<Params> }) {
  const { region: slug } = await params;
  const region = regionFromSlug(slug);
  if (!region) notFound();

  const spaces = await fetchPublicSpaces();
  const inRegion = spaces.filter((space) => space.region === region);
  const counts = new Map<string, number>();
  for (const space of inRegion) counts.set(space.category, (counts.get(space.category) ?? 0) + 1);
  const activeCategories = CATEGORIES.filter((category) => (counts.get(category.key) ?? 0) > 0);
  const districts = Array.from(new Set(inRegion.map((space) => space.district).filter(Boolean)));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="text-[12px] text-ink-mute">
        <Link href="/areas" className="hover:text-brand-dark">
          지역별 찾기
        </Link>
        <span className="mx-1">›</span>
        <span className="font-bold text-ink-soft">{region}</span>
      </nav>

      <h1 className="mt-2 text-2xl font-extrabold text-ink">
        {region} 공간대여 <span className="text-brand-dark">{inRegion.length}</span>
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        {inRegion.length > 0
          ? `${region}에서 지금 예약할 수 있는 공간이에요. 시간 단위로 골라 바로 예약하고, 입금 안내까지 한 번에 확인하세요.`
          : `${region}에는 아직 공개된 공간이 없어요. 곧 사장님들의 공간이 열리면 이 페이지에서 바로 만날 수 있어요.`}
      </p>
      {districts.length > 0 && (
        <p className="mt-1 text-[12px] text-ink-mute">지역 · {districts.join(" · ")}</p>
      )}

      {activeCategories.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {activeCategories.map((category) => (
            <Link
              key={category.key}
              href={`/areas/${regionSlug(region)}/${category.key}`}
              className="rounded-full border border-ink-line bg-white px-3.5 py-2 text-xs font-bold text-ink-soft hover:border-brand hover:text-brand-dark"
            >
              {category.emoji} {region} {category.label} {counts.get(category.key)}
            </Link>
          ))}
        </div>
      )}

      {inRegion.length > 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {inRegion.map((space) => (
            <SpaceCard key={space.id} space={space} />
          ))}
        </div>
      ) : (
        <div className="card mt-6 p-8 text-center">
          <p className="text-sm font-bold text-ink">아직 이 지역에 공개된 공간이 없어요</p>
          <p className="mt-1 text-xs text-ink-mute">다른 지역을 보거나, 전체 검색에서 카테고리로 찾아보세요.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link href="/areas" className="btn-soft btn-sm">
              지역 다시 고르기
            </Link>
            <Link href="/search" className="btn-primary btn-sm">
              전체 공간 보기
            </Link>
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-2 text-[12px]">
        {CATEGORIES.map((category) => (
          <Link
            key={category.key}
            href={`/areas/${regionSlug(region)}/${category.key}`}
            className="rounded-full bg-ink-line/40 px-3 py-1.5 font-semibold text-ink-soft hover:bg-brand-light hover:text-brand-dark"
          >
            {region} {CATEGORY_MAP[category.key].label}
          </Link>
        ))}
      </div>

      {inRegion.length > 0 && (
        <section className="mt-10 rounded-xl2 border border-ink-line bg-white p-5">
          <h2 className="text-sm font-extrabold text-ink">{region} 공간, 이렇게 고르세요</h2>
          <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-ink-soft">
            {inRegion.slice(0, 3).map((space) => (
              <li key={space.id}>
                · <b className="text-ink">{space.name}</b> — {areaLabel(space)} ·{" "}
                {CATEGORY_MAP[space.category]?.label} · {space.capacity}명
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
