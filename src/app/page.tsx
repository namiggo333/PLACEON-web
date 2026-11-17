"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { CategoryChips } from "@/components/Bits";
import { SearchPanel, TimeDealSection } from "@/components/HomeSections";
import { SpaceGrid, SpaceMedia } from "@/components/SpaceCard";
import { BoltIcon, ChevronRightIcon, SparkleIcon, StoreIcon } from "@/components/Icons";
import { PRICE_RANGES, REGIONS } from "@/lib/constants";
import { averageRating, filterSpaces, type SortKey } from "@/lib/filter";
import { won } from "@/lib/format";
import type { Category } from "@/lib/types";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recommend", label: "추천순" },
  { key: "price", label: "가격 낮은순" },
  { key: "rating", label: "평점 높은순" },
  { key: "reviews", label: "리뷰 많은순" },
];

export default function HomePage() {
  const router = useRouter();
  const { visibleSpaces, ready, bookings } = useApp();
  const [region, setRegion] = useState("all");
  const [price, setPrice] = useState("all");
  const [sort, setSort] = useState<SortKey>("recommend");

  const filtered = useMemo(
    () => filterSpaces(visibleSpaces, { region, price, sort }),
    [visibleSpaces, region, price, sort]
  );

  const todayBookings = bookings.filter((booking) => booking.status !== "cancelled").length;
  const showcase = visibleSpaces.find((space) => space.featured && space.timeDeal) ?? visibleSpaces[0];

  function selectCategory(category: Category | "all") {
    router.push(category === "all" ? "/search" : `/search?category=${category}`);
  }

  function resetFilters() {
    setRegion("all");
    setPrice("all");
    setSort("recommend");
  }

  return (
    <div>
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-light via-[#FFF7FB] to-white">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-16 top-40 h-56 w-56 rounded-full bg-fuchsia-300/20 blur-3xl"
          aria-hidden
        />
        <div className="container-page relative pb-8 pt-10 sm:pb-12 sm:pt-16">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-white/80 px-3 py-1 text-[11px] font-bold text-brand">
            <BoltIcon size={13} />
            시간 단위로 빌리는 모든 공간
          </span>
          <div className="relative max-w-2xl">
            <h1 className="mt-4 text-[30px] font-black leading-[1.2] tracking-tight text-ink sm:text-[44px] lg:text-5xl">
              <span className="block">오늘 놀 곳,</span>
              <span className="block">
                1초 만에 <span className="text-brand">예약</span>하고
              </span>
              <span className="block">바로 결제하세요</span>
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-ink-soft sm:text-base">
              파티룸 · 연습실 · 촬영스튜디오 · 회의실 · 공유주방 · 루프탑 · 스터디룸.
              <br className="hidden sm:block" />
              실시간으로 비어 있는 공간을 골라 시간당 요금으로 예약하세요.
            </p>
          </div>

          {showcase ? (
            <div className="absolute right-4 top-16 hidden w-[288px] xl:block" aria-hidden>
              <div className="rotate-2 rounded-2xl bg-white/95 p-3 shadow-float ring-1 ring-brand/10">
                <div className="relative aspect-[16/10] overflow-hidden rounded-xl">
                  <SpaceMedia space={showcase} />
                  <span className="badge absolute left-2 top-2 bg-brand text-white">실시간 예약</span>
                </div>
                <div className="px-1 pb-0.5 pt-2.5">
                  <p className="truncate text-xs font-extrabold text-ink">{showcase.name}</p>
                  <p className="mt-0.5 text-[10px] text-ink-mute">
                    {showcase.region} {showcase.district} · 최대 {showcase.capacity}명
                  </p>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-sm font-black text-brand">
                      {won(Math.round((showcase.pricePerHour * (100 - showcase.discountRate)) / 100))}
                    </span>
                    <span className="text-[10px] text-ink-mute">/시간</span>
                  </div>
                </div>
              </div>
              <div className="ml-6 mt-3 inline-flex -rotate-1 items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-bold text-brand shadow-card ring-1 ring-brand/10">
                <SparkleIcon size={12} />
                사장님 자체 손님은 수수료 0%
              </div>
            </div>
          ) : ready ? null : (
            <div className="absolute right-4 top-16 hidden w-[288px] xl:block" aria-hidden>
              <div className="rotate-2 rounded-2xl bg-white/95 p-3 shadow-float ring-1 ring-brand/10">
                <div className="skeleton aspect-[16/10] rounded-xl" />
                <div className="space-y-2 px-1 pb-0.5 pt-2.5">
                  <div className="skeleton h-3 w-3/4" />
                  <div className="skeleton h-2.5 w-1/2" />
                  <div className="skeleton h-4 w-1/3" />
                </div>
              </div>
            </div>
          )}

          <div className="mt-7 max-w-3xl">
            <SearchPanel />
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3 sm:max-w-lg">
            <div>
              {ready ? (
                <p className="text-xl font-extrabold text-ink sm:text-2xl">{visibleSpaces.length}</p>
              ) : (
                <div className="skeleton h-7 w-12 sm:h-8" />
              )}
              <p className="mt-0.5 text-[11px] text-ink-mute">등록 공간</p>
            </div>
            <div>
              {ready ? (
                <p className="text-xl font-extrabold text-ink sm:text-2xl">{averageRating(visibleSpaces)}</p>
              ) : (
                <div className="skeleton h-7 w-12 sm:h-8" />
              )}
              <p className="mt-0.5 text-[11px] text-ink-mute">평균 평점</p>
            </div>
            <div>
              {ready ? (
                <p className="text-xl font-extrabold text-ink sm:text-2xl">{todayBookings}</p>
              ) : (
                <div className="skeleton h-7 w-10 sm:h-8" />
              )}
              <p className="mt-0.5 text-[11px] text-ink-mute">내 예약 현황</p>
            </div>
          </div>
        </div>
      </section>

      <div className="container-page -mt-1 space-y-10 pb-4 pt-6 sm:space-y-12 sm:pt-8">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title">어떤 공간이 필요하세요?</h2>
            <Link href="/search" className="flex items-center gap-0.5 text-xs font-semibold text-ink-mute hover:text-brand">
              전체 보기
              <ChevronRightIcon size={14} />
            </Link>
          </div>
          <CategoryChips active="all" onSelect={selectCategory} />
        </section>

        {ready && <TimeDealSection spaces={visibleSpaces} />}

        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="section-title">지금 예약 가능한 공간</h2>
              <p className="mt-1 text-xs text-ink-mute">
                {region === "all" ? "전국" : region} · {ready ? `${filtered.length}개의 공간` : "공간을 불러오는 중"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={region}
                onChange={(event) => setRegion(event.target.value)}
                className="rounded-lg border border-ink-line bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-soft focus:border-brand focus:outline-none"
                aria-label="지역 필터"
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
                className="rounded-lg border border-ink-line bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-soft focus:border-brand focus:outline-none"
                aria-label="가격대 필터"
              >
                {PRICE_RANGES.map((range) => (
                  <option key={range.key} value={range.key}>
                    {range.label}
                  </option>
                ))}
              </select>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className="rounded-lg border border-ink-line bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-soft focus:border-brand focus:outline-none"
                aria-label="정렬"
              >
                {SORTS.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {ready ? (
            <SpaceGrid spaces={filtered} onReset={resetFilters} />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="card overflow-hidden">
                  <div className="skeleton aspect-[16/10] rounded-none" />
                  <div className="space-y-2 p-4">
                    <div className="skeleton h-3 w-1/3" />
                    <div className="skeleton h-4 w-3/4" />
                    <div className="skeleton h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl2 bg-gradient-to-br from-brand to-brand-dark p-6 text-white sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold">
                <StoreIcon size={13} /> 사장님을 위한 플레이스온
              </span>
              <h2 className="mt-3 text-xl font-black leading-snug sm:text-2xl">
                인스타·블로그로 데려온 손님은
                <br />
                수수료 부담 없이 전용 링크로 받으세요
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-white/80 sm:text-sm">
                공간 등록 3분이면 끝. 예약 승인·공실 광고·타임특가·간편 결제 링크까지 사장님 센터에서 한 번에.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:w-52">
              <Link
                href="/host"
                className="btn bg-white text-brand hover:bg-brand-light"
              >
                <SparkleIcon size={16} />
                사장님 센터 열기
              </Link>
              <Link
                href="/auth?mode=signup&role=host"
                className="btn border border-white/40 text-white hover:bg-white/10"
              >
                무료로 공간 등록하기
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
