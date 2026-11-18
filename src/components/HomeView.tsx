"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { CategoryChips } from "@/components/Bits";
import { MascotBanner, SearchPanel, TimeDealSection } from "@/components/HomeSections";
import { SpaceGrid } from "@/components/SpaceCard";
import { ChevronRightIcon, SparkleIcon, StoreIcon } from "@/components/Icons";
import { SloganUnderline } from "@/components/Logo";
import { PRICE_RANGES, REGIONS } from "@/lib/constants";
import { filterSpaces, type SortKey } from "@/lib/filter";
import type { Category, Space } from "@/lib/types";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recommend", label: "추천순" },
  { key: "price", label: "가격 낮은순" },
  { key: "rating", label: "평점 높은순" },
  { key: "reviews", label: "리뷰 많은순" },
];

export default function HomeView({ initialSpaces }: { initialSpaces: Space[] }) {
  const router = useRouter();
  const { visibleSpaces, ready } = useApp();
  const [region, setRegion] = useState("all");
  const [price, setPrice] = useState("all");
  const [sort, setSort] = useState<SortKey>("recommend");

  // 서버(SSR/ISR)가 내려준 초기 목록으로 바로 그리고, 로그인·사장님 데이터가
  // 준비되면 숨김 공간까지 반영한 목록으로 조용히 교체한다.
  const spaces = ready ? visibleSpaces : initialSpaces;

  const filtered = useMemo(
    () => filterSpaces(spaces, { region, price, sort }),
    [spaces, region, price, sort]
  );

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
      <section className="relative overflow-hidden bg-[linear-gradient(180deg,#FFF0F6_0%,#FFF6FA_45%,#FFFCFE_82%,#FFFFFF_100%)]">
        <div
          className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-brand/15 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-24 top-40 h-72 w-72 rounded-full bg-[#FFD9E9]/70 blur-3xl"
          aria-hidden
        />
        <div className="container-page relative pb-8 pt-9 sm:pb-12 sm:pt-14">
          <div className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-10">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-white/80 px-3 py-1 text-[11px] font-bold text-brand">
                <SparkleIcon size={13} />
                찾고, 예약하고, 결제까지 — 한 번에!
              </span>

              <h1 className="mt-4 text-[31px] font-black leading-[1.2] tracking-[-0.045em] text-ink sm:text-[42px] lg:text-[46px]">
                <span className="block">원하는 공간,</span>
                <span className="block">
                  <span className="relative inline-block text-brand">
                    지금 바로
                    <SloganUnderline className="-bottom-1.5 text-brand sm:-bottom-2" />
                  </span>{" "}
                  찾아보세요!
                </span>
              </h1>

              <p className="mt-3.5 max-w-lg text-sm leading-relaxed text-ink-soft sm:text-base">
                파티룸 · 키즈룸 · 연습실 · 촬영스튜디오 · 회의실 · 공유주방 · 루프탑 · 스터디룸.
                <br className="hidden sm:block" />
                실시간으로 비어 있는 공간을 골라 시간당 요금으로 예약하세요.
              </p>

              <MascotBanner compact className="mt-5 lg:hidden" />

              <div className="mt-5 max-w-3xl sm:mt-6">
                <SearchPanel />
              </div>

              <div className="mt-6 flex max-w-md divide-x divide-brand/15 sm:max-w-lg">
                {[
                  { icon: "⚡", label: "실시간 공실" },
                  { icon: "⏱️", label: "예약 3초" },
                  { icon: "🩷", label: "사장님 수수료 0%" },
                ].map((item) => (
                  <div key={item.label} className="px-4 first:pl-0 last:pr-0 sm:px-6">
                    <p className="text-[13px] font-extrabold text-ink sm:text-sm">
                      <span aria-hidden className="mr-1">{item.icon}</span>
                      {item.label}
                    </p>
                    <p className="mt-1 text-[11px] text-ink-mute">
                      {item.label === "실시간 공실"
                        ? "비어 있는 시간만 노출"
                        : item.label === "예약 3초"
                          ? "날짜·시간만 고르면 끝"
                          : "전용 링크로 받은 손님"}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="hidden lg:block">
              <MascotBanner />
              <p className="mt-3 text-center text-[11px] font-semibold text-ink-mute">
                사장님은 수수료 0%로, 손님은 3초 만에 예약해요
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="container-page -mt-1 space-y-10 pb-4 pt-6 sm:space-y-12 sm:pt-8">
        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="section-title">어떤 공간이 필요하세요?</h2>
            <Link href="/search" className="flex items-center gap-0.5 text-xs font-semibold text-ink-mute hover:text-brand">
              전체 보기
              <ChevronRightIcon size={14} />
            </Link>
          </div>
          <CategoryChips active="all" onSelect={selectCategory} className="-mx-1 px-1" />
        </section>

        {spaces.length > 0 && <TimeDealSection spaces={spaces} />}

        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="section-title">지금 예약 가능한 공간</h2>
              <p className="mt-1 text-xs text-ink-mute">
                {region === "all" ? "실시간으로 비어 있는 공간을 모았어요" : `${region}에서 찾은 공간`}
                {filtered.length > 0 ? ` · ${filtered.length}곳` : ""}
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

          <SpaceGrid
            spaces={filtered}
            onReset={resetFilters}
            emptyTitle={
              region === "all" && price === "all"
                ? "아직 등록된 공간이 없어요"
                : "이 조건에 맞는 공간을 찾지 못했어요"
            }
            emptyHint={
              region === "all" && price === "all"
                ? "곳곳에서 새 공간을 준비하고 있어요. 조금만 기다려 주세요!"
                : "지역이나 가격 조건을 조금 넓혀 보시고, 원하는 공간이 없다면 사장님께 등록을 요청해 보세요."
            }
          />
        </section>

        <section className="relative overflow-hidden rounded-xl3 bg-gradient-to-br from-[#1B1624] via-[#2A1B2C] to-[#4A1F38] p-6 text-white sm:p-8">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand/30 blur-3xl"
            aria-hidden
          />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-md">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/25 px-2.5 py-1 text-[11px] font-bold text-[#FFB0CE]">
                <StoreIcon size={13} /> 사장님을 위한 이곳저곳
              </span>
              <h2 className="mt-3 text-xl font-black leading-snug sm:text-2xl">
                인스타·블로그로 데려온 손님은
                <br />
                수수료 부담 없이 전용 링크로 받으세요
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-white/70 sm:text-sm">
                공간 등록 3분이면 끝. 예약 승인·공실 광고·타임특가·간편 결제 링크까지 사장님 센터에서 한 번에.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Link href="/host" className="btn bg-brand text-white hover:bg-brand-dark sm:w-auto">
                  <SparkleIcon size={16} />
                  사장님 센터 열기
                </Link>
                <Link
                  href="/auth?mode=signup&role=host"
                  className="btn border border-white/30 text-white hover:bg-white/10 sm:w-auto"
                >
                  무료로 공간 등록하기
                </Link>
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/mascot-wave.webp"
              alt="엄지척하는 이곳저곳 마스코트"
              className="pointer-events-none hidden h-44 w-44 shrink-0 rounded-full object-cover ring-4 ring-white/15 sm:block lg:h-52 lg:w-52"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
