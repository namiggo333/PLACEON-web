"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { CategoryChips } from "@/components/Bits";
import { SpaceMedia } from "@/components/SpaceCard";
import {
  BoltIcon,
  CalendarIcon,
  CheckIcon,
  CloseIcon,
  SearchIcon,
  ShieldIcon,
  StoreIcon,
  TrashIcon,
  UsersIcon,
} from "@/components/Icons";
import { isAdminEmail } from "@/lib/admin";
import { CATEGORY_MAP, STATUS_LABEL, STATUS_STYLE } from "@/lib/constants";
import { fetchAdminData, patchSpace, removeSpace, updateBookingStatus, type AdminData } from "@/lib/db";
import {
  cn,
  endTime,
  formatDate,
  formatTime,
  formatRelativeDate,
  shortId,
  won,
  wonShort,
} from "@/lib/format";
import type { Booking, BookingStatus, Category, Space } from "@/lib/types";

type TabKey = "spaces" | "bookings" | "members";

const TABS: { key: TabKey; label: string; icon: typeof StoreIcon }[] = [
  { key: "spaces", label: "입점 공간 관리", icon: StoreIcon },
  { key: "bookings", label: "예약 현황", icon: CalendarIcon },
  { key: "members", label: "사장님·회원", icon: UsersIcon },
];

const STATUS_FILTERS: { key: BookingStatus | "all"; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "pending", label: "대기중" },
  { key: "confirmed", label: "예약확정" },
  { key: "cancelled", label: "취소" },
];

function joinedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function Switch({
  checked,
  onChange,
  label,
  hint,
  busy,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={busy}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition disabled:opacity-60",
        checked ? "border-brand/30 bg-brand-light/70" : "border-ink-line bg-white hover:border-brand/30"
      )}
    >
      <span className="min-w-0">
        <span className="block text-[11px] font-bold text-ink">{label}</span>
        {hint && <span className="mt-0.5 block truncate text-[9px] text-ink-mute">{hint}</span>}
      </span>
      <span
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition",
          checked ? "bg-brand" : "bg-ink-line"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
            checked ? "left-[18px]" : "left-0.5"
          )}
        />
      </span>
    </button>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = "light",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "brand" | "light";
}) {
  return (
    <div
      className={cn(
        "rounded-xl2 border p-4",
        tone === "brand" ? "border-brand/20 bg-brand-light" : "card"
      )}
    >
      <p className={cn("text-[11px] font-semibold", tone === "brand" ? "text-brand/80" : "text-ink-mute")}>
        {label}
      </p>
      <p className={cn("mt-1 text-2xl font-black", tone === "brand" ? "text-brand" : "text-ink")}>{value}</p>
      <p className={cn("mt-0.5 text-[10px]", tone === "brand" ? "text-brand/70" : "text-ink-mute")}>{hint}</p>
    </div>
  );
}

export default function AdminPage() {
  const { ready, mode, user, refresh } = useApp();
  const admin = isAdminEmail(user?.email);

  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabKey>("spaces");
  const [spaceQuery, setSpaceQuery] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [bookingQuery, setBookingQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">("all");
  const [memberQuery, setMemberQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchAdminData());
    } catch (err) {
      setError(err instanceof Error ? err.message : "관리자 데이터를 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ready && admin) void load();
  }, [ready, admin, load]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const stats = useMemo(() => {
    const spaces = data?.spaces ?? [];
    const bookings = data?.bookings ?? [];
    const profiles = data?.profiles ?? [];
    const hidden = spaces.filter((space) => space.hidden).length;
    const ad = spaces.filter((space) => space.featured).length;
    const deal = spaces.filter((space) => space.timeDeal).length;
    const pending = bookings.filter((booking) => booking.status === "pending").length;
    const confirmed = bookings.filter((booking) => booking.status === "confirmed").length;
    const cancelled = bookings.filter((booking) => booking.status === "cancelled").length;
    const revenue = bookings
      .filter((booking) => booking.status !== "cancelled")
      .reduce((sum, booking) => sum + booking.totalAmount, 0);
    const hosts = profiles.filter((profile) => profile.role === "host").length;
    const guests = profiles.filter((profile) => profile.role === "guest").length;
    return {
      spaces: spaces.length,
      hidden,
      visible: spaces.length - hidden,
      ad,
      deal,
      bookings: bookings.length,
      pending,
      confirmed,
      cancelled,
      revenue,
      profiles: profiles.length,
      hosts,
      guests,
    };
  }, [data]);

  const spaceCountByHost = useMemo(() => {
    const map = new Map<string, number>();
    for (const space of data?.spaces ?? []) {
      map.set(space.hostId, (map.get(space.hostId) ?? 0) + 1);
    }
    return map;
  }, [data]);

  const bookingCountByGuest = useMemo(() => {
    const map = new Map<string, number>();
    for (const booking of data?.bookings ?? []) {
      if (!booking.guestId) continue;
      map.set(booking.guestId, (map.get(booking.guestId) ?? 0) + 1);
    }
    return map;
  }, [data]);

  const bookingCountBySpace = useMemo(() => {
    const map = new Map<string, number>();
    for (const booking of data?.bookings ?? []) {
      map.set(booking.spaceId, (map.get(booking.spaceId) ?? 0) + 1);
    }
    return map;
  }, [data]);

  const filteredSpaces = useMemo(() => {
    const query = spaceQuery.trim().toLowerCase();
    return (data?.spaces ?? []).filter((space) => {
      if (category !== "all" && space.category !== category) return false;
      if (!query) return true;
      return [space.name, space.hostName, space.region, space.district, space.address]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [data, spaceQuery, category]);

  const filteredBookings = useMemo(() => {
    const query = bookingQuery.trim().toLowerCase();
    return (data?.bookings ?? []).filter((booking) => {
      if (statusFilter !== "all" && booking.status !== statusFilter) return false;
      if (!query) return true;
      return [booking.spaceName, booking.guestName, booking.guestPhone, shortId(booking.id)]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [data, bookingQuery, statusFilter]);

  const filteredProfiles = useMemo(() => {
    const query = memberQuery.trim().toLowerCase();
    return (data?.profiles ?? []).filter((profile) => {
      if (!query) return true;
      return [profile.name, profile.email].join(" ").toLowerCase().includes(query);
    });
  }, [data, memberQuery]);

  async function toggleSpace(
    space: Space,
    patch: { hidden?: boolean; featured?: boolean; timeDeal?: boolean },
    message: string
  ) {
    setBusyId(space.id);
    try {
      const updated = await patchSpace(space.id, patch);
      if (updated) {
        setData((prev) =>
          prev ? { ...prev, spaces: prev.spaces.map((item) => (item.id === updated.id ? updated : item)) } : prev
        );
      }
      setToast(message);
      void refresh();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "변경에 실패했어요.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteSpace(space: Space) {
    setBusyId(space.id);
    try {
      await removeSpace(space.id);
      setData((prev) =>
        prev
          ? {
              ...prev,
              spaces: prev.spaces.filter((item) => item.id !== space.id),
              bookings: prev.bookings.filter((booking) => booking.spaceId !== space.id),
            }
          : prev
      );
      setConfirmDelete(null);
      setToast("공간을 삭제했어요. 연결된 예약도 함께 정리했어요.");
      void refresh();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "삭제에 실패했어요.");
    } finally {
      setBusyId(null);
    }
  }

  async function changeBookingStatus(booking: Booking, status: BookingStatus) {
    setBusyId(booking.id);
    try {
      const updated = await updateBookingStatus(booking.id, status);
      if (updated) {
        setData((prev) =>
          prev
            ? { ...prev, bookings: prev.bookings.map((item) => (item.id === updated.id ? updated : item)) }
            : prev
        );
      }
      setToast(
        status === "confirmed" ? "예약을 확정했어요." : status === "cancelled" ? "예약을 취소했어요." : "예약을 대기 상태로 되돌렸어요."
      );
    } catch (err) {
      setToast(err instanceof Error ? err.message : "예약 상태를 바꾸지 못했어요.");
    } finally {
      setBusyId(null);
    }
  }

  if (!ready) {
    return (
      <div className="container-page py-10">
        <div className="skeleton h-28 w-full" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="skeleton h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container-page py-12 sm:py-16">
        <div className="mx-auto max-w-md text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-light text-brand">
            <ShieldIcon size={26} />
          </span>
          <h1 className="mt-4 text-xl font-black text-ink">총괄 관리자 전용 페이지</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-mute">
            전체 공간·예약·회원을 관리하려면 관리자 계정으로 로그인해 주세요.
          </p>
          <Link href="/auth?next=/admin" className="btn-primary mt-5 w-full py-3">
            관리자로 로그인
          </Link>
          <Link href="/" className="mt-2 block text-xs font-semibold text-ink-mute hover:text-brand">
            이곳저곳 홈으로
          </Link>
        </div>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="container-page py-12 sm:py-16">
        <div className="mx-auto max-w-md text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-slate-400">
            <ShieldIcon size={26} />
          </span>
          <h1 className="mt-4 text-xl font-black text-ink">접근 권한이 없어요</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-mute">
            <b className="text-ink-soft">{user.email}</b> 계정은 총괄 관리자 권한이 없어요.
            <br />
            관리자 계정으로 다시 로그인해 주세요.
          </p>
          <Link href="/auth?next=/admin" className="btn-primary mt-5 w-full py-3">
            다른 계정으로 로그인
          </Link>
          <Link href="/" className="mt-2 block text-xs font-semibold text-ink-mute hover:text-brand">
            이곳저곳 홈으로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-6 sm:py-10">
      <section className="overflow-hidden rounded-xl2 bg-gradient-to-br from-[#1B1624] via-[#2A1B2C] to-[#5A1B3A] p-5 text-white sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold tracking-wide">
              <ShieldIcon size={12} /> 이곳저곳 ADMIN
            </p>
            <h1 className="mt-2.5 text-2xl font-black tracking-tight sm:text-3xl">이곳저곳 총괄 관리자</h1>
            <p className="mt-1 text-xs text-white/75">
              {user.name} 님 · 전체 공간 {stats.spaces}개 · 예약 {stats.bookings}건 · 회원 {stats.profiles}명을 관리합니다.
            </p>
            {mode === "demo" && (
              <p className="mt-2 rounded-lg bg-white/10 px-2.5 py-1.5 text-[10px] text-white/80">
                데모(체험) 모드예요. 변경 내용은 이 브라우저에만 저장돼요.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-lg bg-white/15 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/25"
            >
              새로고침
            </button>
            <Link
              href="/"
              className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-brand transition hover:bg-brand-light"
            >
              사이트 보기
            </Link>
          </div>
        </div>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="전체 등록 공간"
          value={`${stats.spaces}개`}
          hint={`공개 ${stats.visible} · 비공개 ${stats.hidden}`}
          tone="brand"
        />
        <StatCard
          label="총 예약 건수"
          value={`${stats.bookings}건`}
          hint={`대기 ${stats.pending} · 확정 ${stats.confirmed} · 취소 ${stats.cancelled}`}
        />
        <StatCard label="총 예약 금액" value={wonShort(stats.revenue)} hint="취소 예약 제외 합계" />
        <StatCard
          label="가입 회원"
          value={`${stats.profiles}명`}
          hint={`사장님 ${stats.hosts} · 게스트 ${stats.guests}`}
        />
      </div>

      <div className="no-scrollbar mt-5 flex gap-1 overflow-x-auto rounded-xl bg-ink-line/40 p-1">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.key;
          const count =
            item.key === "spaces" ? stats.spaces : item.key === "bookings" ? stats.bookings : stats.profiles;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition sm:text-sm",
                active ? "bg-white text-ink shadow-sm" : "text-ink-mute hover:text-ink"
              )}
            >
              <Icon size={15} />
              {item.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  active ? "bg-brand text-white" : "bg-white text-ink-mute"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
          {error}
          <button type="button" onClick={() => void load()} className="ml-2 underline">
            다시 시도
          </button>
        </div>
      )}

      {loading && (
        <div className="mt-5 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="skeleton h-28 w-full" />
          ))}
        </div>
      )}

      {!loading && data && tab === "spaces" && (
        <section className="mt-5">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-extrabold text-ink">
                입점 공간 <span className="text-brand">{filteredSpaces.length}</span>
                <span className="ml-1 text-xs font-semibold text-ink-mute">/ 전체 {stats.spaces}개</span>
              </h2>
              <div className="relative w-full sm:max-w-xs">
                <SearchIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
                <input
                  value={spaceQuery}
                  onChange={(event) => setSpaceQuery(event.target.value)}
                  placeholder="공간명·사장님·지역 검색"
                  className="input py-2 pl-9 text-xs"
                  aria-label="공간 검색"
                />
              </div>
            </div>
            <CategoryChips active={category} onSelect={setCategory} size="sm" className="pb-0.5" />
          </div>

          {filteredSpaces.length === 0 ? (
            <div className="card mt-4 flex flex-col items-center gap-2 px-6 py-14 text-center">
              <StoreIcon size={30} className="text-brand/60" />
              <p className="text-sm font-bold text-ink">조건에 맞는 공간이 없어요</p>
              <p className="text-xs text-ink-mute">검색어나 카테고리를 바꿔 보세요.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {filteredSpaces.map((space) => (
                <article key={space.id} className="card p-3.5">
                  <div className="flex gap-3">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-ink-line">
                      <SpaceMedia space={space} emojiSize="text-2xl" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className={cn("badge", space.hidden ? "bg-slate-700 text-white" : "bg-emerald-50 text-emerald-600")}>
                          {space.hidden ? "비공개" : "공개"}
                        </span>
                        {space.featured && <span className="badge bg-ink text-white">AD 노출</span>}
                        {space.timeDeal && space.discountRate > 0 && (
                          <span className="badge bg-brand-light text-brand">타임특가 {space.discountRate}%</span>
                        )}
                        <span className="text-[10px] font-semibold text-ink-mute">
                          No. {shortId(space.id)}
                        </span>
                      </div>
                      <h3 className="mt-1 truncate text-sm font-extrabold text-ink">{space.name}</h3>
                      <p className="mt-0.5 truncate text-[11px] text-ink-soft">
                        {CATEGORY_MAP[space.category]?.label ?? space.category} · {space.region} {space.district} ·{" "}
                        {won(space.pricePerHour)}/시간 · {space.capacity}명
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-ink-mute">
                        사장님 {space.hostName} · 예약 {bookingCountBySpace.get(space.id) ?? 0}건 · 등록{" "}
                        {formatRelativeDate(space.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2.5 grid gap-1.5 sm:grid-cols-3">
                    <Switch
                      checked={!space.hidden}
                      busy={busyId === space.id}
                      onChange={(value) =>
                        void toggleSpace(
                          space,
                          { hidden: !value },
                          value ? "공간을 공개로 전환했어요." : "공간을 비공개로 전환했어요."
                        )
                      }
                      label="손님에게 공개"
                      hint={space.hidden ? "검색·홈에서 숨김" : "홈·검색에 노출 중"}
                    />
                    <Switch
                      checked={space.featured}
                      busy={busyId === space.id}
                      onChange={(value) =>
                        void toggleSpace(
                          space,
                          { featured: value },
                          value ? "상단 광고를 켰어요." : "상단 광고를 껐어요."
                        )
                      }
                      label="상단 광고"
                      hint={space.featured ? "지역 상단 노출 중" : "꺼짐"}
                    />
                    <Switch
                      checked={space.timeDeal}
                      busy={busyId === space.id}
                      onChange={(value) =>
                        void toggleSpace(
                          space,
                          { timeDeal: value },
                          value ? "타임특가를 켰어요." : "타임특가를 껐어요."
                        )
                      }
                      label="타임특가"
                      hint={
                        space.discountRate > 0
                          ? `${space.discountRate}% 할인 노출`
                          : "할인율 0% · 사장님이 설정"
                      }
                    />
                  </div>

                  <div className="mt-2.5 flex items-center justify-end gap-2">
                    <Link href={`/spaces/${space.id}`} className="btn-ghost btn-sm">
                      상세 보기
                    </Link>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(space.id)}
                      className="btn-sm inline-flex items-center gap-1 rounded-lg border border-ink-line px-2.5 font-semibold text-ink-mute transition hover:border-red-200 hover:text-red-500"
                    >
                      <TrashIcon size={13} />
                      삭제
                    </button>
                  </div>

                  {confirmDelete === space.id && (
                    <div className="mt-2 rounded-lg bg-red-50 p-3">
                      <p className="text-[11px] font-semibold text-red-700">
                        <b>{space.name}</b> 을(를) 삭제할까요? 연결된 예약 {bookingCountBySpace.get(space.id) ?? 0}건도 함께
                        삭제되며 되돌릴 수 없어요.
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          disabled={busyId === space.id}
                          onClick={() => void deleteSpace(space)}
                          className="rounded-lg bg-red-500 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-60"
                        >
                          {busyId === space.id ? "삭제 중…" : "삭제"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(null)}
                          className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-bold text-ink-soft"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {!loading && data && tab === "bookings" && (
        <section className="mt-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-extrabold text-ink">
              예약 현황 <span className="text-brand">{filteredBookings.length}</span>
              <span className="ml-1 text-xs font-semibold text-ink-mute">/ 전체 {stats.bookings}건</span>
            </h2>
            <div className="relative w-full sm:max-w-xs">
              <SearchIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
              <input
                value={bookingQuery}
                onChange={(event) => setBookingQuery(event.target.value)}
                placeholder="예약번호·공간명·예약자 검색"
                className="input py-2 pl-9 text-xs"
                aria-label="예약 검색"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setStatusFilter(item.key)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[11px] font-bold transition",
                  statusFilter === item.key
                    ? "border-brand bg-brand text-white"
                    : "border-ink-line bg-white text-ink-soft hover:border-brand/40 hover:text-brand"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {filteredBookings.length === 0 ? (
            <div className="card mt-4 flex flex-col items-center gap-2 px-6 py-14 text-center">
              <CalendarIcon size={30} className="text-brand/60" />
              <p className="text-sm font-bold text-ink">조건에 맞는 예약이 없어요</p>
              <p className="text-xs text-ink-mute">상태 필터나 검색어를 바꿔 보세요.</p>
            </div>
          ) : (
            <>
              <div className="card mt-4 hidden overflow-x-auto md:block">
                <table className="w-full min-w-[860px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-ink-line bg-ink-line/25 text-[11px] text-ink-mute">
                      <th className="px-3 py-2.5 font-bold">예약번호</th>
                      <th className="px-3 py-2.5 font-bold">공간명</th>
                      <th className="px-3 py-2.5 font-bold">예약자</th>
                      <th className="px-3 py-2.5 font-bold">이용 일시</th>
                      <th className="px-3 py-2.5 font-bold">인원</th>
                      <th className="px-3 py-2.5 text-right font-bold">금액</th>
                      <th className="px-3 py-2.5 font-bold">상태</th>
                      <th className="px-3 py-2.5 text-right font-bold">상태 변경</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.map((booking) => (
                      <tr key={booking.id} className="border-b border-ink-line/70 last:border-0">
                        <td className="px-3 py-2.5 font-mono text-[10px] text-ink-mute">{shortId(booking.id)}</td>
                        <td className="max-w-[180px] px-3 py-2.5">
                          <span className="block truncate font-bold text-ink">{booking.spaceName}</span>
                          <span className="text-[10px] text-ink-mute">
                            {booking.source === "link" ? "결제 링크" : "웹"} · {formatRelativeDate(booking.createdAt)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="block font-semibold text-ink">{booking.guestName}</span>
                          <span className="text-[10px] text-ink-mute">{booking.guestPhone}</span>
                        </td>
                        <td className="px-3 py-2.5 text-ink-soft">
                          {formatDate(booking.date)}
                          <span className="block text-[10px] text-ink-mute">
                            {formatTime(booking.startTime)} ~ {endTime(booking.startTime, booking.hours)} · {booking.hours}시간
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-ink-soft">{booking.guests}명</td>
                        <td className="px-3 py-2.5 text-right font-extrabold text-ink">{won(booking.totalAmount)}</td>
                        <td className="px-3 py-2.5">
                          <span className={cn("badge", STATUS_STYLE[booking.status])}>
                            {STATUS_LABEL[booking.status]}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex justify-end gap-1">
                            {booking.status !== "confirmed" && (
                              <button
                                type="button"
                                disabled={busyId === booking.id}
                                onClick={() => void changeBookingStatus(booking, "confirmed")}
                                className="inline-flex items-center gap-0.5 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600 hover:bg-emerald-100 disabled:opacity-50"
                              >
                                <CheckIcon size={11} /> 확정
                              </button>
                            )}
                            {booking.status !== "cancelled" ? (
                              <button
                                type="button"
                                disabled={busyId === booking.id}
                                onClick={() => void changeBookingStatus(booking, "cancelled")}
                                className="inline-flex items-center gap-0.5 rounded-md bg-red-50 px-2 py-1 text-[10px] font-bold text-red-500 hover:bg-red-100 disabled:opacity-50"
                              >
                                <CloseIcon size={11} /> 취소
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={busyId === booking.id}
                                onClick={() => void changeBookingStatus(booking, "pending")}
                                className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-200 disabled:opacity-50"
                              >
                                <BoltIcon size={11} /> 대기
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 space-y-2.5 md:hidden">
                {filteredBookings.map((booking) => (
                  <article key={booking.id} className="card p-3.5">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("badge", STATUS_STYLE[booking.status])}>
                        {STATUS_LABEL[booking.status]}
                      </span>
                      <span className="font-mono text-[10px] text-ink-mute">No. {shortId(booking.id)}</span>
                      <span className="text-[10px] text-ink-mute">
                        · {booking.source === "link" ? "결제 링크" : "웹"} · {formatRelativeDate(booking.createdAt)}
                      </span>
                    </div>
                    <h3 className="mt-1.5 truncate text-sm font-extrabold text-ink">{booking.spaceName}</h3>
                    <p className="mt-0.5 text-[11px] text-ink-soft">
                      {booking.guestName} · {booking.guestPhone}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-mute">
                      {formatDate(booking.date)} {formatTime(booking.startTime)} ~{" "}
                      {endTime(booking.startTime, booking.hours)} · {booking.hours}시간 · {booking.guests}명
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-black text-ink">{won(booking.totalAmount)}</span>
                      <div className="flex gap-1.5">
                        {booking.status !== "confirmed" && (
                          <button
                            type="button"
                            disabled={busyId === booking.id}
                            onClick={() => void changeBookingStatus(booking, "confirmed")}
                            className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-600 disabled:opacity-50"
                          >
                            확정
                          </button>
                        )}
                        {booking.status !== "cancelled" ? (
                          <button
                            type="button"
                            disabled={busyId === booking.id}
                            onClick={() => void changeBookingStatus(booking, "cancelled")}
                            className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-500 disabled:opacity-50"
                          >
                            취소
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId === booking.id}
                            onClick={() => void changeBookingStatus(booking, "pending")}
                            className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-500 disabled:opacity-50"
                          >
                            대기로
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {!loading && data && tab === "members" && (
        <section className="mt-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-extrabold text-ink">
              입점 사장님·회원 <span className="text-brand">{filteredProfiles.length}</span>
              <span className="ml-1 text-xs font-semibold text-ink-mute">/ 전체 {stats.profiles}명</span>
            </h2>
            <div className="relative w-full sm:max-w-xs">
              <SearchIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
              <input
                value={memberQuery}
                onChange={(event) => setMemberQuery(event.target.value)}
                placeholder="이름·이메일 검색"
                className="input py-2 pl-9 text-xs"
                aria-label="회원 검색"
              />
            </div>
          </div>

          {filteredProfiles.length === 0 ? (
            <div className="card mt-4 flex flex-col items-center gap-2 px-6 py-14 text-center">
              <UsersIcon size={30} className="text-brand/60" />
              <p className="text-sm font-bold text-ink">조건에 맞는 회원이 없어요</p>
              <p className="text-xs text-ink-mute">검색어를 바꿔 보세요.</p>
            </div>
          ) : (
            <>
              <div className="card mt-4 hidden overflow-x-auto md:block">
                <table className="w-full min-w-[720px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-ink-line bg-ink-line/25 text-[11px] text-ink-mute">
                      <th className="px-3 py-2.5 font-bold">이름</th>
                      <th className="px-3 py-2.5 font-bold">이메일</th>
                      <th className="px-3 py-2.5 font-bold">역할</th>
                      <th className="px-3 py-2.5 font-bold">가입일</th>
                      <th className="px-3 py-2.5 text-right font-bold">등록 공간</th>
                      <th className="px-3 py-2.5 text-right font-bold">예약</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProfiles.map((profile) => (
                      <tr key={profile.id} className="border-b border-ink-line/70 last:border-0">
                        <td className="px-3 py-2.5 font-bold text-ink">{profile.name}</td>
                        <td className="px-3 py-2.5 text-ink-soft">
                          <span className="inline-flex items-center gap-1">
                            {isAdminEmail(profile.email) && (
                              <span className="badge bg-brand-light text-brand">ADMIN</span>
                            )}
                            {profile.email}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={cn(
                              "badge",
                              profile.role === "host" ? "bg-brand-light text-brand" : "bg-slate-100 text-slate-500"
                            )}
                          >
                            {profile.role === "host" ? "사장님" : "게스트"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-ink-soft">{joinedAt(profile.createdAt)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-ink">
                          {spaceCountByHost.get(profile.id) ?? 0}개
                        </td>
                        <td className="px-3 py-2.5 text-right text-ink-soft">
                          {bookingCountByGuest.get(profile.id) ?? 0}건
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 space-y-2.5 md:hidden">
                {filteredProfiles.map((profile) => (
                  <article key={profile.id} className="card p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-sm font-extrabold text-ink">
                          {profile.name}
                          <span
                            className={cn(
                              "badge",
                              profile.role === "host" ? "bg-brand-light text-brand" : "bg-slate-100 text-slate-500"
                            )}
                          >
                            {profile.role === "host" ? "사장님" : "게스트"}
                          </span>
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-ink-soft">{profile.email}</p>
                      </div>
                      {isAdminEmail(profile.email) && (
                        <span className="badge shrink-0 bg-brand text-white">ADMIN</span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-ink-mute">
                      <span>가입 {joinedAt(profile.createdAt)}</span>
                      <span>등록 공간 {spaceCountByHost.get(profile.id) ?? 0}개</span>
                      <span>예약 {bookingCountByGuest.get(profile.id) ?? 0}건</span>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 md:bottom-8">
          <div className="rounded-full bg-ink px-4 py-2.5 text-xs font-bold text-white shadow-float">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
