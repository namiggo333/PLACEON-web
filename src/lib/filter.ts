import type { Category, Space } from "./types";
import { CATEGORY_MAP } from "./constants";

export type SortKey = "recommend" | "price" | "rating" | "reviews";

export interface SpaceFilters {
  query?: string;
  category?: Category | "all";
  region?: string;
  price?: string;
  guests?: number;
  sort?: SortKey;
}

const PRICE_BOUNDS: Record<string, [number, number]> = {
  all: [0, Number.POSITIVE_INFINITY],
  under3: [0, 30000],
  "3to5": [30000, 50000],
  "5to10": [50000, 100000],
  over10: [100000, Number.POSITIVE_INFINITY],
};

export function filterSpaces(spaces: Space[], filters: SpaceFilters): Space[] {
  const query = (filters.query ?? "").trim().toLowerCase();
  const category = filters.category ?? "all";
  const region = filters.region ?? "all";
  const [minPrice, maxPrice] = PRICE_BOUNDS[filters.price ?? "all"] ?? PRICE_BOUNDS.all;
  const guests = filters.guests ?? 0;

  const filtered = spaces.filter((space) => {
    if (category !== "all" && space.category !== category) return false;
    if (region !== "all" && space.region !== region) return false;
    if (space.pricePerHour < minPrice || space.pricePerHour >= maxPrice) return false;
    if (guests > 0 && space.capacity < guests) return false;
    if (query) {
      const haystack = [
        space.name,
        space.region,
        space.district,
        space.address,
        CATEGORY_MAP[space.category]?.label ?? "",
        space.description,
        space.amenities.join(" "),
        space.hostName,
      ]
        .join(" ")
        .toLowerCase();
      const tokens = query.split(/\s+/).filter(Boolean);
      if (!tokens.every((token) => haystack.includes(token))) return false;
    }
    return true;
  });

  const sort = filters.sort ?? "recommend";
  return filtered.sort((a, b) => {
    if (sort === "price") return a.pricePerHour - b.pricePerHour;
    if (sort === "rating") return b.rating - a.rating;
    if (sort === "reviews") return b.reviewCount - a.reviewCount;
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return b.rating * Math.log10(b.reviewCount + 10) - a.rating * Math.log10(a.reviewCount + 10);
  });
}

export function averageRating(spaces: Space[]): string {
  const rated = spaces.filter((space) => space.rating > 0);
  if (!rated.length) return "—";
  const avg = rated.reduce((sum, space) => sum + space.rating, 0) / rated.length;
  return avg.toFixed(2);
}
