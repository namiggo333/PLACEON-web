import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/lib/constants";
import { fetchPublicSpaces } from "@/lib/server-data";
import { SITE_URL, regionSlug } from "@/lib/seo";

export const revalidate = 3600;

/**
 * sitemap.xml — 홈·검색·승인된 공개 공간·동네×카테고리 랜딩.
 * 승인 공간이 하나도 없는 지역/조합은 넣지 않는다(noindex 페이지를 sitemap 에 넣지 않기).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const spaces = await fetchPublicSpaces();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/search`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/areas`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/refund`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const spaceEntries: MetadataRoute.Sitemap = spaces.map((space) => ({
    url: `${SITE_URL}/spaces/${space.id}`,
    lastModified: space.createdAt ? new Date(space.createdAt) : now,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const regionCounts = new Map<string, number>();
  const comboCounts = new Map<string, number>();
  for (const space of spaces) {
    regionCounts.set(space.region, (regionCounts.get(space.region) ?? 0) + 1);
    const key = `${space.region}|${space.category}`;
    comboCounts.set(key, (comboCounts.get(key) ?? 0) + 1);
  }

  const areaEntries: MetadataRoute.Sitemap = [];
  for (const [region, count] of regionCounts) {
    const slug = regionSlug(region);
    if (!slug || count < 1) continue;
    areaEntries.push({
      url: `${SITE_URL}/areas/${slug}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    });
    for (const category of CATEGORIES) {
      const combo = comboCounts.get(`${region}|${category.key}`) ?? 0;
      if (combo < 1) continue;
      areaEntries.push({
        url: `${SITE_URL}/areas/${slug}/${category.key}`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.6,
      });
    }
  }

  return [...staticEntries, ...areaEntries, ...spaceEntries];
}
