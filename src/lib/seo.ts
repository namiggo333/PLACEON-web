import type { Metadata } from "next";
import { CATEGORY_MAP, REGIONS } from "./constants";
import { won } from "./format";
import type { Category, Space } from "./types";

export const SITE_URL = (process.env.SITE_URL ?? "https://igotjeogot.vercel.app").replace(/\/$/, "");
export const SITE_NAME = "이곳저곳";

/**
 * 지역(시·도) 한글 이름 ↔ URL 슬러그.
 * 검색 파라미터는 한글(`?region=서울`)을 그대로 쓰고, SEO 랜딩은 짧은 영문 슬러그를 쓴다.
 */
export const REGION_SLUGS: Record<string, string> = {
  서울: "seoul",
  경기: "gyeonggi",
  인천: "incheon",
  부산: "busan",
  대구: "daegu",
  대전: "daejeon",
  광주: "gwangju",
  울산: "ulsan",
  세종: "sejong",
  강원: "gangwon",
  충북: "chungbuk",
  충남: "chungnam",
  전북: "jeonbuk",
  전남: "jeonnam",
  경북: "gyeongbuk",
  경남: "gyeongnam",
  제주: "jeju",
};

export const SLUG_REGIONS: Record<string, string> = Object.fromEntries(
  Object.entries(REGION_SLUGS).map(([region, slug]) => [slug, region])
);

export function regionSlug(region: string): string | null {
  return REGION_SLUGS[region] ?? null;
}

export function regionFromSlug(slug: string): string | null {
  return SLUG_REGIONS[(slug ?? "").toLowerCase()] ?? null;
}

export function categoryFromSlug(slug: string): Category | null {
  const key = (slug ?? "").toLowerCase();
  const hit = Object.keys(CATEGORY_MAP).find((item) => item === key);
  return hit ? (hit as Category) : null;
}

/** "서울 성동구" 처럼 동네 라벨 */
export function areaLabel(space: Pick<Space, "region" | "district">): string {
  return [space.region, space.district].filter(Boolean).join(" ");
}

/** 공간 상세 공유용 메타데이터 */
export function spaceMetadata(space: Space): Metadata {
  const category = CATEGORY_MAP[space.category]?.label ?? "공간";
  const price =
    space.discountRate > 0
      ? `타임특가 ${won(Math.round((space.pricePerHour * (100 - space.discountRate)) / 100))}/시간`
      : `시간당 ${won(space.pricePerHour)}`;
  const title = `${space.name} · ${areaLabel(space)} ${category} | ${SITE_NAME}`;
  const description = `${areaLabel(space)} ${category} · ${price} · ${space.capacity}명까지. 이곳저곳에서 시간 단위로 예약하고 입금 안내까지 한 번에 확인하세요.`;
  const url = `${SITE_URL}/spaces/${space.id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    keywords: [space.name, `${areaLabel(space)} ${category}`, "공간대여", "이곳저곳", category],
    openGraph: {
      title,
      description,
      url,
      type: "website",
      locale: "ko_KR",
      siteName: SITE_NAME,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

/** 전용 결제 링크 공유용 메타데이터 */
export function payMetadata(space: Space): Metadata {
  const category = CATEGORY_MAP[space.category]?.label ?? "공간";
  const title = `${space.name} 예약 · ${areaLabel(space)} ${category} | ${SITE_NAME}`;
  const description = `로그인 없이 3초 만에 예약. ${areaLabel(space)} ${category}, ${won(
    Math.round((space.pricePerHour * (100 - space.discountRate)) / 100)
  )}/시간부터. 이곳저곳 전용 예약 링크입니다.`;
  const url = `${SITE_URL}/pay/${space.paySlug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", locale: "ko_KR", siteName: SITE_NAME },
    twitter: { card: "summary_large_image", title, description },
  };
}

/** 검색 색인에서 제외 (승인 공간이 없는 빈 동네·카테고리 조합) */
export const NOINDEX: Metadata["robots"] = { index: false, follow: true };

export function areaTitle(region: string, category?: Category | null): string {
  const label = category ? CATEGORY_MAP[category]?.label : null;
  return label ? `${region} ${label} 대여 · 시간 단위 예약` : `${region} 공간대여 · 파티룸·연습실·스튜디오`;
}

export const ALL_REGIONS = REGIONS;
