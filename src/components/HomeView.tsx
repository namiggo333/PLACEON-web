"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { CategoryChips } from "@/components/Bits";
import { MascotBanner, SearchPanel, TimeDealSection } from "@/components/HomeSections";
import { SpaceGrid } from "@/components/SpaceCard";
import { ChevronRightIcon, CloseIcon, SparkleIcon, StoreIcon } from "@/components/Icons";
import { SloganUnderline } from "@/components/Logo";
import { fetchSoldOutSpaces } from "@/lib/availability";
import { PRICE_RANGES, REGIONS } from "@/lib/constants";
import { filterSpaces, type SortKey } from "@/lib/filter";
import { todayISO } from "@/lib/format";
import type { Category, Space } from "@/lib/types";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recommend", label: "추천순" },
  { key: "price", label: "가격 낮은순" },
];

export default function HomeView({ initialSpaces }: { initialSpaces: Space[] }) {
  const router = useRouter();
  const { visibleSpaces, ready } = useApp();
  const [region, setRegion] = useState("all");
  const [price, setPrice] = useState("all");
  const [sort, setSort] = useState<SortKey>("recommend");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [soldOut, setSoldOut] = useState<Set<string>>(new Set());

  // 서버(SSR/ISR)가 내려준 초기 목록으로 바로 그리고, 로그인·사장님 데이터가
  // 준비되면 숨김 공간까지 반영한 목록으로 조용히 교체한다.
  const spaces = ready ? visibleSpaces : initialSpaces;

  const filtered = useMemo(
    () => filterSpaces(spaces, { region, price, sort }),
    [spaces, region, price, sort]
  );

  // 카드의 '마감' 배지 — 오늘 예약 가능한 시간이 하나도 없는 공간 (실패해도 화면은 그대로)
  useEffect(() => {
    if (!ready || spaces.length === 0) return;
    let alive = true;
    const ids = spaces.map((space) => space.id).slice(0, 40);
    fetchSoldOutSpaces(ids, todayISO())
      .then((set) => {
        if (alive) setSoldOut(set);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [ready, spaces]);

  function selectCategory(category: Category | "all") {
    router.push(category === "all" ? "/search" : `/search?category=${category}`);
  }

  function resetFilters() {
    setRegion("all");
    setPrice("all");
    setSort("recommend");
  }

  const priceLabel = PRICE_RANGES.find((range) => range.key === price)?.label ?? "전체 가격";
  const activeCount = (region !== "all" ? 1 : 0) + (price !== "all" ? 1 : 0) + (sort !== "recommend" ? 1 : 0);

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
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-10">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-white/80 px-3 py-1 text-[12px] font-bold text-brand-dark">
                <SparkleIcon size={13} />
                찾고, 예약 요청하고, 입금 확인까지 — 한 번에
              </span>

              <h1 className="mt-4 heading-1 text-ink sm:text-[40px] lg:text-[44px]">
                <span className="block">원하는 공간,</span>
                <span className="block">
                  <span className="relative inline-block text-brand-dark">
                    지금 바로
                    <SloganUnderline className="-bottom-1.5 text-brand-dark sm:-bottom-2" />
                  </span>{" "}
                  찾아보세요!
                </span>
              </h1>

              <p className="mt-3.5 max-w-lg text-sm leading-relaxed text-ink-soft sm:text-base">
                파티룸 · 키즈룸 · 연습실 · 촬영스튜디오 · 회의실 · 공유주방 · 루프탑 · 스터디룸.{" "}
                <br className="hidden sm:block" />
                실시간으로 비어 있는 공간을 골라 시간당 요금으로 예약하세요.
              </p>

              <MascotBanner compact className="mt-5 lg:hidden" />

              <div className="mt-5 max-w-3xl sm:mt-6">
                <SearchPanel />
              </div>

              <div className="mt-6 flex max-w-md divide-x divide-brand/15 sm:max-w-lg">
                {[
                  { icon: "⚡", label: "실시간 공실", hint: "비어 있는 시간만 노출" },
                  { icon: "🗓", label: "예약 요청", hint: "날짜·시간만 고르면 끝" },
                  { icon: "🩷", label: "입금하면 확정", hint: "결제 전 금액 그대로" },
                ].map((item) => (
                  <div key={item.label} className="px-4 first:pl-0 last:pr-0 sm:px-6">
                    <p className="text-[13px] font-extrabold text-ink sm:text-sm">
                      <span aria-hidden className="mr-1">
                        {item.icon}
                      </span>
                      {item.label}
                    </p>
                    <p className="mt-1 text-[12px] text-ink-mute">{item.hint}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="hidden lg:block">
              <MascotBanner />
              <p className="mt-3 text-center text-[12px] font-semibold text-ink-mute">
                마음에 드는 공간을 고르고, 예약·입금 안내까지 한 번에!
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="container-page -mt-1 space-y-10 pb-4 pt-6 sm:space-y-12 sm:pt-8">
        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="section-title">어떤 공간이 필요하세요?</h2>
            <Link href="/search" className="flex items-center gap-0.5 text-xs font-semibold text-ink-mute hover:text-brand-dark">
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
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="ui-chip"
              aria-haspopup="dialog"
            >
              <SparkleIcon size={14} />
              필터
              {activeCount > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[12px] font-bold text-white">
                  {activeCount}
                </span>
              )}
            </button>
          </div>

          {activeCount > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {region !== "all" && (
                <button
                  type="button"
                  onClick={() => setRegion("all")}
                  className="ui-chip ui-chip--summary"
                  aria-label={`${region} 필터 해제`}
                >
                  {region}
                  <CloseIcon size={13} />
                </button>
              )}
              {price !== "all" && (
                <button
                  type="button"
                  onClick={() => setPrice("all")}
                  className="ui-chip ui-chip--summary"
                  aria-label={`${priceLabel} 필터 해제`}
                >
                  {priceLabel}
                  <CloseIcon size={13} />
                </button>
              )}
              {sort !== "recommend" && (
                <button
                  type="button"
                  onClick={() => setSort("recommend")}
                  className="ui-chip ui-chip--summary"
                  aria-label="정렬 필터 해제"
                >
                  가격 낮은순
                  <CloseIcon size={13} />
                </button>
              )}
              <button
                type="button"
                onClick={resetFilters}
                className="ui-chip ui-chip--summary border border-ink-line bg-white text-ink-mute"
              >
                초기화
              </button>
            </div>
          )}

          <SpaceGrid
            spaces={filtered}
            soldOutIds={soldOut}
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
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/25 px-2.5 py-1 text-[12px] font-bold text-[#FFB0CE]">
                <StoreIcon size={13} /> 사장님을 위한 이곳저곳
              </span>
              <h2 className="mt-3 text-xl font-extrabold leading-snug sm:text-2xl">
                공간을 운영하고 계신가요?
                <br />
                예약·입금 관리를 한곳에서 받아 보세요
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-white/70 sm:text-sm">
                공간 등록 3분이면 끝. 예약 승인·공실 관리·타임특가·전용 예약 링크까지 사장님 센터에서 한 번에.
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

      {/* 필터 바텀시트 — 홈의 select 3개를 하나로 모았다 */}
      {sheetOpen && (
        <>
          <div
            className="ui-sheet-backdrop"
            role="presentation"
            onClick={() => setSheetOpen(false)}
          />
          <div className="ui-sheet" role="dialog" aria-modal="true" aria-label="공간 필터">
            <div className="ui-sheet-handle" />
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-ink">어디서, 얼마로 찾을까요?</h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-xl text-ink-mute hover:bg-ink-line/60"
                aria-label="필터 닫기"
              >
                <CloseIcon size={20} />
              </button>
            </div>

            <div className="mt-4">
              <p className="text-[13px] font-bold text-ink-soft">지역</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setRegion("all")}
                  aria-pressed={region === "all"}
                  className="ui-chip"
                >
                  지역 전체
                </button>
                {REGIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setRegion(item)}
                    aria-pressed={region === item}
                    className="ui-chip"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <p className="text-[13px] font-bold text-ink-soft">가격대</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PRICE_RANGES.map((range) => (
                  <button
                    key={range.key}
                    type="button"
                    onClick={() => setPrice(range.key)}
                    aria-pressed={price === range.key}
                    className="ui-chip"
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <p className="text-[13px] font-bold text-ink-soft">정렬</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SORTS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSort(item.key)}
                    aria-pressed={sort === item.key}
                    className="ui-chip"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 flex gap-2 pb-1">
              <button
                type="button"
                onClick={() => {
                  resetFilters();
                  setSheetOpen(false);
                }}
                className="btn-ghost shrink-0 px-4"
              >
                초기화
              </button>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="btn-primary flex-1 py-3"
              >
                {filtered.length}곳 보기
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
