"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { REGIONS } from "@/lib/constants";
import { midnightCountdown, won } from "@/lib/format";
import type { Space } from "@/lib/types";
import { SpaceMedia } from "./SpaceCard";
import { ClockIcon, PinIcon, SearchIcon, SparkleIcon, UsersIcon } from "./Icons";

export function SearchPanel() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("all");
  const [guests, setGuests] = useState("0");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (region !== "all") params.set("region", region);
    if (guests !== "0") params.set("guests", guests);
    router.push(`/search?${params.toString()}`);
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-2 rounded-2xl bg-white p-2.5 shadow-float md:flex-row md:items-center md:gap-1 md:rounded-full md:p-2"
    >
      <label className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2 md:rounded-full">
        <SearchIcon size={18} className="shrink-0 text-brand" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="어떤 공간을 찾으시나요?"
          className="w-full bg-transparent text-sm font-medium text-ink outline-none placeholder:text-ink-mute"
          aria-label="공간 검색"
        />
      </label>
      <span className="hidden h-8 w-px bg-ink-line md:block" />
      <div className="grid grid-cols-2 gap-1.5 md:contents">
        <label className="flex items-center gap-1.5 rounded-xl bg-ink-line/40 px-2.5 py-2 md:rounded-full md:bg-transparent md:px-3">
          <PinIcon size={15} className="shrink-0 text-ink-mute" />
          <select
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            className="w-full bg-transparent text-[13px] font-semibold text-ink outline-none md:w-24 md:text-sm"
            aria-label="지역 선택"
          >
            <option value="all">지역 전체</option>
            {REGIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 rounded-xl bg-ink-line/40 px-2.5 py-2 md:rounded-full md:bg-transparent md:px-3">
          <UsersIcon size={15} className="shrink-0 text-ink-mute" />
          <select
            value={guests}
            onChange={(event) => setGuests(event.target.value)}
            className="w-full bg-transparent text-[13px] font-semibold text-ink outline-none md:w-24 md:text-sm"
            aria-label="인원 선택"
          >
            <option value="0">인원 전체</option>
            {[2, 4, 6, 10, 15, 20, 25].map((count) => (
              <option key={count} value={count}>
                {count}명 이상
              </option>
            ))}
          </select>
        </label>
      </div>
      <span className="hidden h-8 w-px bg-ink-line md:block" />
      <button type="submit" className="btn-primary md:rounded-full md:px-6">
        <SearchIcon size={17} />
        검색
      </button>
    </form>
  );
}

export function TimeDealSection({ spaces }: { spaces: Space[] }) {
  const [countdown, setCountdown] = useState("--:--:--");

  useEffect(() => {
    const tick = () => setCountdown(midnightCountdown());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const deals = spaces.filter((space) => space.timeDeal && space.discountRate > 0);
  if (!deals.length) return null;

  return (
    <section className="overflow-hidden rounded-xl2 bg-gradient-to-br from-[#14192D] via-[#1D2740] to-[#3A2B28] px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-white">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white shadow-pop">
            <SparkleIcon size={17} />
          </span>
          <div>
            <h2 className="text-base font-extrabold sm:text-lg">오늘의 공실 타임특가</h2>
            <p className="text-[11px] text-white/60">비어 있는 시간대를 최대 25% 할인가로</p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-white/90 backdrop-blur">
          <ClockIcon size={14} />
          <span className="text-[11px] font-medium">오늘 마감까지</span>
          <span className="text-sm font-extrabold tabular-nums tracking-wider">{countdown}</span>
        </span>
      </div>

      <div className="no-scrollbar mt-4 flex gap-3 overflow-x-auto pb-1">
        {deals.map((space) => {
          const finalPrice = Math.round((space.pricePerHour * (100 - space.discountRate)) / 100);
          return (
            <Link
              key={space.id}
              href={`/spaces/${space.id}`}
              className="group w-[220px] shrink-0 overflow-hidden rounded-xl bg-white/95 shadow-sm transition hover:-translate-y-0.5 sm:w-[240px]"
            >
              <div className="relative h-28 overflow-hidden">
                <SpaceMedia space={space} />
                <span className="badge absolute left-2 top-2 bg-brand text-white">
                  {space.discountRate}% OFF
                </span>
              </div>
              <div className="p-3">
                <p className="text-[10px] font-medium text-ink-mute">
                  {space.region} {space.district}
                </p>
                <p className="mt-0.5 truncate text-sm font-bold text-ink group-hover:text-brand">
                  {space.name}
                </p>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-sm font-extrabold text-brand">{won(finalPrice)}</span>
                  <span className="text-[10px] text-ink-mute line-through">{won(space.pricePerHour)}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
