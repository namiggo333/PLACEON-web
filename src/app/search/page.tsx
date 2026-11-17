"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { CategoryChips } from "@/components/Bits";
import { SpaceGrid } from "@/components/SpaceCard";
import { SearchIcon } from "@/components/Icons";
import { PRICE_RANGES, REGIONS } from "@/lib/constants";
import { filterSpaces, type SortKey } from "@/lib/filter";
import type { Category } from "@/lib/types";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recommend", label: "추천순" },
  { key: "price", label: "가격 낮은순" },
  { key: "rating", label: "평점 높은순" },
  { key: "reviews", label: "리뷰 많은순" },
];

function SearchContent() {
  const params = useSearchParams();
  const { spaces, ready } = useApp();

  const initialCategory = (params.get("category") ?? "all") as Category | "all";
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState<Category | "all">(initialCategory);
  const [region, setRegion] = useState(params.get("region") ?? "all");
  const [price, setPrice] = useState(params.get("price") ?? "all");
  const [guests, setGuests] = useState(Number(params.get("guests") ?? 0));
  const [sort, setSort] = useState<SortKey>((params.get("sort") as SortKey) ?? "recommend");

  const results = useMemo(
    () => filterSpaces(spaces, { query, category, region, price, guests, sort }),
    [spaces, query, category, region, price, guests, sort]
  );

  function reset() {
    setQuery("");
    setCategory("all");
    setRegion("all");
    setPrice("all");
    setGuests(0);
    setSort("recommend");
  }

  return (
    <div className="container-page py-6 sm:py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">공간 찾기</h1>
        <p className="muted">지역·키워드·카테고리로 원하는 공간을 골라보세요.</p>
      </div>

      <form
        onSubmit={(event) => event.preventDefault()}
        className="mt-4 flex items-center gap-2 rounded-2xl border border-ink-line bg-white p-2 shadow-card focus-within:border-brand/50"
      >
        <SearchIcon size={18} className="ml-1.5 shrink-0 text-brand" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="성수 루프탑, 파티룸, 촬영 스튜디오…"
          className="w-full bg-transparent px-1 py-1.5 text-sm font-medium outline-none placeholder:text-ink-mute"
          aria-label="검색어"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-ink-mute hover:text-brand"
          >
            지우기
          </button>
        )}
      </form>

      <div className="mt-4">
        <CategoryChips active={category} onSelect={setCategory} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <select
          value={region}
          onChange={(event) => setRegion(event.target.value)}
          className="rounded-lg border border-ink-line bg-white px-3 py-2 text-xs font-semibold text-ink-soft focus:border-brand focus:outline-none"
          aria-label="지역"
        >
          <option value="all">지역 전체</option>
          {REGIONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          className="rounded-lg border border-ink-line bg-white px-3 py-2 text-xs font-semibold text-ink-soft focus:border-brand focus:outline-none"
          aria-label="가격대"
        >
          {PRICE_RANGES.map((range) => (
            <option key={range.key} value={range.key}>
              {range.label}
            </option>
          ))}
        </select>
        <select
          value={guests}
          onChange={(event) => setGuests(Number(event.target.value))}
          className="rounded-lg border border-ink-line bg-white px-3 py-2 text-xs font-semibold text-ink-soft focus:border-brand focus:outline-none"
          aria-label="인원"
        >
          <option value={0}>인원 전체</option>
          {[2, 4, 6, 10, 15, 20, 25].map((count) => (
            <option key={count} value={count}>
              {count}명 이상
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as SortKey)}
          className="rounded-lg border border-ink-line bg-white px-3 py-2 text-xs font-semibold text-ink-soft focus:border-brand focus:outline-none"
          aria-label="정렬"
        >
          {SORTS.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={reset} className="rounded-lg px-2 py-2 text-xs font-semibold text-ink-mute hover:text-brand">
          초기화
        </button>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">
          {query ? `‘${query}’ ` : ""}검색 결과 <span className="text-brand">{results.length}</span>개
        </p>
        <p className="text-[11px] text-ink-mute">시간당 요금 · 실시간 예약</p>
      </div>

      <div className="mt-3">
        {ready ? (
          <SpaceGrid spaces={results} onReset={reset} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="card overflow-hidden">
                <div className="skeleton aspect-[16/10] rounded-none" />
                <div className="space-y-2 p-4">
                  <div className="skeleton h-3 w-1/3" />
                  <div className="skeleton h-4 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="container-page py-10">
          <div className="skeleton h-8 w-40" />
          <div className="mt-4 skeleton h-12 w-full" />
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
