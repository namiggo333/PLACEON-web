"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { LogoMark, MascotAvatar } from "@/components/Logo";
import { DemoAccountButtons } from "@/components/Bits";
import { DepositInfoRow } from "@/components/DepositInfoRow";
import { SpaceMedia } from "@/components/SpaceCard";
import { QrShare } from "@/components/host/QrShare";
import {
  BoltIcon,
  CalendarIcon,
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
  CopyIcon,
  EyeOffIcon,
  HourglassIcon,
  LinkIcon,
  PhotoIcon,
  PlusIcon,
  SparkleIcon,
  StoreIcon,
  UsersIcon,
  ClockIcon,
  ShieldIcon,
} from "@/components/Icons";
import {
  APPROVAL_LABEL,
  APPROVAL_STYLE,
  CATEGORIES,
  CATEGORY_MAP,
  REFUND_LABEL,
  REFUND_STYLE,
  REGIONS,
  bookingStatusMeta,
} from "@/lib/constants";
import { cn, endTime, formatDate, formatRelativeDate, formatTime, shortId, won, wonShort } from "@/lib/format";
import {
  MAX_PHOTOS,
  deleteSpacePhotos,
  uploadSpacePhotos,
  validatePhoto,
} from "@/lib/storage";
import { SITE_URL } from "@/lib/site-url";
import type { Booking, Category, Role, Space, SpaceInput, SpacePrivate } from "@/lib/types";
import { BookingTimeline } from "@/components/BookingAccess";
import { IcalPanel } from "@/components/host/IcalPanel";
import { MonthlySavings } from "@/components/host/MonthlySavings";
import { PasteImporter } from "@/components/host/PasteImporter";

type TabKey = "dashboard" | "spaces" | "bookings" | "schedule" | "links";

const TABS: { key: TabKey; label: string; icon: typeof StoreIcon }[] = [
  { key: "dashboard", label: "대시보드", icon: BoltIcon },
  { key: "spaces", label: "내 공간", icon: StoreIcon },
  { key: "bookings", label: "예약 관리", icon: CalendarIcon },
  { key: "schedule", label: "시간 관리", icon: ClockIcon },
  { key: "links", label: "결제 링크", icon: LinkIcon },
];

/** 모바일 하단 탭 — 360px 화면에서도 4개가 한 번에 보이도록 대표 동선만 남긴다. */
const MOBILE_TABS: { key: TabKey; label: string; icon: typeof StoreIcon }[] = [
  { key: "dashboard", label: "오늘", icon: BoltIcon },
  { key: "bookings", label: "예약", icon: CalendarIcon },
  { key: "spaces", label: "공간", icon: StoreIcon },
  { key: "links", label: "공유", icon: LinkIcon },
];

interface FormState {
  name: string;
  category: Category;
  region: string;
  district: string;
  address: string;
  price: string;
  capacity: string;
  discount: string;
  description: string;
  amenities: string;
  featured: boolean;
  timeDeal: boolean;
  hidden: boolean;
  photos: string[];
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  detailAddress: string;
  entryGuide: string;
  parkingGuide: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  category: "party",
  region: "서울",
  district: "",
  address: "",
  price: "",
  capacity: "10",
  discount: "0",
  description: "",
  amenities: "와이파이, 냉장고, 주차",
  featured: false,
  timeDeal: false,
  hidden: false,
  photos: [],
  bankName: "",
  accountNumber: "",
  accountHolder: "",
  detailAddress: "",
  entryGuide: "",
  parkingGuide: "",
};

function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-ink-line px-3 py-2.5 text-left transition hover:border-brand/40"
    >
      <span>
        <span className="block text-xs font-bold text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-[12px] text-ink-mute">{hint}</span>}
      </span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition",
          checked ? "bg-brand" : "bg-ink-line"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
            checked ? "left-[22px]" : "left-0.5"
          )}
        />
      </span>
    </button>
  );
}

export default function HostPage() {
  const {
    ready,
    mode,
    user,
    spaces,
    spaceAccounts,
    bookings,
    bookingEvents,
    createSpace,
    updateSpace,
    deleteSpace,
    setBookingStatus,
    updateRefund,
    createBlock,
    releaseBlock,
    loadSpacePrivate,
    demoSignIn,
    reset,
  } = useApp();

  const [tab, setTab] = useState<TabKey>("dashboard");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Space | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busyBooking, setBusyBooking] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [origin, setOrigin] = useState(SITE_URL);
  const [linkSpaceId, setLinkSpaceId] = useState("");
  const [demoBusy, setDemoBusy] = useState<Role | null>(null);
  const [blockForm, setBlockForm] = useState({ spaceId: "", date: "", startTime: "10:00", hours: 2, memo: "" });
  const [confirmBooking, setConfirmBooking] = useState<Booking | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [blockBusy, setBlockBusy] = useState(false);
  const [blockError, setBlockError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const mySpaces = useMemo(() => spaces.filter((space) => space.hostId === user?.id), [spaces, user?.id]);
  const mySpaceIds = useMemo(() => new Set(mySpaces.map((space) => space.id)), [mySpaces]);
  const myBookings = useMemo(
    () =>
      bookings
        .filter(
          (booking) =>
            booking.source === "guest" &&
            (booking.hostId === user?.id || mySpaceIds.has(booking.spaceId))
        )
        .sort((a, b) => {
          if (a.status === "pending" && b.status !== "pending") return -1;
          if (a.status !== "pending" && b.status === "pending") return 1;
          return b.createdAt.localeCompare(a.createdAt);
        }),
    [bookings, user?.id, mySpaceIds]
  );

  const myBlocks = useMemo(
    () =>
      bookings
        .filter(
          (booking) =>
            booking.source === "block" &&
            booking.status !== "cancelled" &&
            mySpaceIds.has(booking.spaceId)
        )
        .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`)),
    [bookings, mySpaceIds]
  );

  /** 오늘 처리할 일 — 입금 확인(신고 도착 우선) · 환불 처리 두 종류만. */
  const todayQueue = useMemo(() => {
    return myBookings
      .filter((booking) => booking.status === "pending" || booking.refundStatus === "pending")
      .sort((a, b) => {
        const aClaim = a.paidClaimedAt ? 1 : 0;
        const bClaim = b.paidClaimedAt ? 1 : 0;
        if (aClaim !== bClaim) return bClaim - aClaim;
        return `${a.expiresAt ?? ""}`.localeCompare(`${b.expiresAt ?? ""}`);
      });
  }, [myBookings]);

  useEffect(() => {
    if (!blockForm.spaceId && mySpaces.length > 0) {
      setBlockForm((prev) => ({ ...prev, spaceId: mySpaces[0].id, date: prev.date }));
    }
  }, [mySpaces, blockForm.spaceId]);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const stats = useMemo(() => {
    const monthBookings = myBookings.filter(
      (booking) => booking.date.startsWith(thisMonth) && booking.status !== "cancelled"
    );
    const confirmed = monthBookings.filter((booking) => booking.status === "confirmed");
    return {
      revenue: confirmed.reduce((sum, booking) => sum + booking.totalAmount, 0),
      pending: myBookings.filter((booking) => booking.status === "pending").length,
      confirmedCount: confirmed.length,
      exposed: mySpaces.filter((space) => space.featured).length,
      deals: mySpaces.filter((space) => space.timeDeal).length,
    };
  }, [myBookings, mySpaces, thisMonth]);

  const selectedLinkSpace = useMemo(
    () => mySpaces.find((space) => space.id === linkSpaceId) ?? mySpaces[0],
    [mySpaces, linkSpaceId]
  );

  async function copy(text: string, message = "복사했어요!") {
    if (!text) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        document.body.removeChild(area);
      }
      setToast(message);
    } catch {
      setToast("복사가 차단됐어요. 링크를 길게 눌러 복사해 주세요.");
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setPhotoError("");
    setModalOpen(true);
  }

  function openEdit(space: Space) {
    const account = spaceAccounts[space.id];
    setEditing(space);
    setForm({
      name: space.name,
      category: space.category,
      region: space.region,
      district: space.district,
      address: space.address,
      price: String(space.pricePerHour),
      capacity: String(space.capacity),
      discount: String(space.discountRate),
      description: space.description,
      amenities: space.amenities.join(", "),
      featured: space.featured,
      timeDeal: space.timeDeal,
      hidden: space.hidden,
      photos: space.imageUrls,
      bankName: account?.bankName ?? "",
      accountNumber: account?.accountNumber ?? "",
      accountHolder: account?.accountHolder ?? "",
      detailAddress: "",
      entryGuide: "",
      parkingGuide: "",
    });
    setFormError("");
    setPhotoError("");
    setModalOpen(true);
    void loadSpacePrivate(space.id)
      .then((info: SpacePrivate | null) => {
        if (!info) return;
        setForm((prev) => ({
          ...prev,
          detailAddress: info.detailAddress,
          entryGuide: info.entryGuide,
          parkingGuide: info.parkingGuide,
        }));
      })
      .catch(() => {});
  }

  async function addPhotos(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !user) return;
    setPhotoError("");
    const remaining = MAX_PHOTOS - form.photos.length;
    if (remaining <= 0) {
      setPhotoError(`사진은 최대 ${MAX_PHOTOS}장까지 올릴 수 있어요.`);
      return;
    }
    const picked = Array.from(fileList).slice(0, remaining);
    for (const file of picked) {
      const message = validatePhoto(file);
      if (message) {
        setPhotoError(message);
        return;
      }
    }
    setUploading(true);
    try {
      const urls = await uploadSpacePhotos(picked, user.id);
      setForm((prev) => ({
        ...prev,
        photos: [...prev.photos, ...urls].slice(0, MAX_PHOTOS),
      }));
      if (fileList.length + form.photos.length > MAX_PHOTOS) {
        setPhotoError(`사진은 최대 ${MAX_PHOTOS}장까지라 앞에서부터 ${remaining}장만 올렸어요.`);
      }
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "사진을 올리지 못했어요.");
    } finally {
      setUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  function removePhoto(url: string) {
    setForm((prev) => ({ ...prev, photos: prev.photos.filter((item) => item !== url) }));
  }

  function makeCoverPhoto(url: string) {
    setForm((prev) => ({
      ...prev,
      photos: [url, ...prev.photos.filter((item) => item !== url)],
    }));
  }

  async function submitForm(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    const price = Number(form.price.replace(/[^\d]/g, ""));
    const capacity = Number(form.capacity.replace(/[^\d]/g, ""));
    const discount = Math.min(90, Math.max(0, Number(form.discount.replace(/[^\d]/g, "")) || 0));
    if (!form.name.trim()) return setFormError("공간 이름을 입력해 주세요.");
    if (!price) return setFormError("시간당 가격을 숫자로 입력해 주세요.");
    if (!capacity) return setFormError("최대 인원을 입력해 주세요.");

    const bankName = form.bankName.trim();
    const accountNumber = form.accountNumber.trim();
    const accountHolder = form.accountHolder.trim();
    const filled = [bankName, accountNumber, accountHolder].filter(Boolean).length;
    if (filled > 0 && filled < 3) {
      return setFormError("입금 계좌는 은행·계좌번호·예금주를 모두 입력해 주세요.");
    }

    const payload: SpaceInput = {
      name: form.name.trim(),
      category: form.category,
      region: form.region,
      district: form.district.trim(),
      address: form.address.trim(),
      pricePerHour: price,
      capacity,
      discountRate: discount,
      description: form.description.trim(),
      amenities: form.amenities
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      featured: form.featured,
      timeDeal: form.timeDeal,
      hidden: form.hidden,
      imageUrls: form.photos,
      bankName,
      accountNumber,
      accountHolder,
      detailAddress: form.detailAddress.trim(),
      entryGuide: form.entryGuide.trim(),
      parkingGuide: form.parkingGuide.trim(),
    };

    setSaving(true);
    try {
      if (editing) {
        await updateSpace(editing.id, payload);
        const removed = editing.imageUrls.filter((url) => !form.photos.includes(url));
        if (removed.length > 0) void deleteSpacePhotos(removed);
        setToast("공간 정보를 수정했어요.");
      } else {
        await createSpace(payload);
        setToast("공간을 등록했어요! 관리자 확인 후 손님에게 공개돼요.");
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "저장에 실패했어요.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleField(space: Space, field: "featured" | "timeDeal", value: boolean) {
    try {
      await updateSpace(space.id, { [field]: value });
      setToast(
        field === "featured"
          ? value
            ? "상단 노출 광고를 켰어요."
            : "상단 노출 광고를 껐어요."
          : value
            ? "타임특가를 켰어요."
            : "타임특가를 껐어요."
      );
    } catch (err) {
      setToast(err instanceof Error ? err.message : "변경에 실패했어요.");
    }
  }

  async function toggleHidden(space: Space, value: boolean) {
    try {
      await updateSpace(space.id, { hidden: value });
      setToast(
        value ? "공간을 비공개로 숨겼어요. 손님 화면에 보이지 않아요." : "공간을 다시 공개했어요."
      );
    } catch (err) {
      setToast(err instanceof Error ? err.message : "변경에 실패했어요.");
    }
  }

  async function handleBooking(id: string, status: "confirmed" | "cancelled") {
    setBusyBooking(id);
    try {
      await setBookingStatus(id, status, status === "cancelled" ? "host" : null);
      setToast(
        status === "confirmed"
          ? "입금을 확인해 예약을 확정했어요."
          : "예약을 거절했어요. 그 시간대는 다시 예약받을 수 있어요."
      );
    } catch (err) {
      setToast(err instanceof Error ? err.message : "변경에 실패했어요.");
    } finally {
      setBusyBooking(null);
    }
  }

  if (!ready) {
    return (
      <div className="container-page py-10">
        <div className="skeleton h-10 w-64" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="skeleton h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (!user || user.role !== "host") {
    return (
      <div className="container-page py-12 sm:py-16">
        <div className="mx-auto max-w-md text-center">
          <MascotAvatar size={92} className="mx-auto" />
          <h1 className="mt-4 text-xl font-extrabold text-ink">사장님 센터</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-mute">
            공간을 등록하고 예약·광고·결제 링크를 관리하려면 사장님 계정으로 로그인해 주세요.
          </p>
          {mode === "demo" && (
            <div className="mt-5">
              <DemoAccountButtons
                onPick={async (role) => {
                  setDemoBusy(role);
                  try {
                    await demoSignIn(role);
                  } finally {
                    setDemoBusy(null);
                  }
                }}
                busy={demoBusy}
                compact
              />
            </div>
          )}
          <Link href="/auth?next=/host&role=host" className="btn-primary mt-5 w-full py-3">
            사장님으로 로그인
          </Link>
        </div>
      </div>
    );
  }

  const payLink = selectedLinkSpace ? `${origin}/pay/${selectedLinkSpace.paySlug}` : "";
  const dmText = selectedLinkSpace
    ? `안녕하세요! ${selectedLinkSpace.name} 예약 링크 보내드려요 🩷\n${payLink}\n\n날짜와 시간을 고르시면 바로 예약하실 수 있어요.`
    : "";

  return (
    <div className="container-page py-6 pb-24 sm:py-10 sm:pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] font-bold text-brand-dark">HOST CENTER</p>
          <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            {user.name} 님의 사장님 센터
          </h1>
          <p className="mt-1 text-xs text-ink-mute">
            내 공간 {mySpaces.length}개 · 접수된 예약 {stats.pending}건
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={openCreate} className="btn-primary btn-sm px-3.5 py-2.5">
            <PlusIcon size={15} />
            공간 등록
          </button>
          <Link href="/" className="btn-ghost btn-sm px-3.5 py-2.5">
            게스트 화면
          </Link>
        </div>
      </div>

      <Link
        href="/item#apply"
        className="group mt-4 flex items-center gap-3.5 rounded-xl2 border border-brand/20 bg-[linear-gradient(120deg,#FFF0F6_0%,#FFFFFF_70%)] px-4 py-3.5 transition hover:border-brand/40 hover:shadow-card"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-xl shadow-card" aria-hidden>
          🛍️
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <b className="text-[13.5px] font-extrabold text-ink">이곳저곳 Item이 곧 오픈해요</b>
            <span className="badge bg-brand-dark text-white">오픈예정</span>
          </span>
          <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-soft">
            공간에 필요한 리퍼·비품 특가 몰. 필요한 품목을 미리 신청하면 많이 찾은 것부터 준비해 드려요.
          </span>
        </span>
        <span className="hidden shrink-0 items-center gap-1 text-[12px] font-bold text-brand-dark sm:inline-flex">
          품목 신청
          <ChevronRightIcon size={14} />
        </span>
      </Link>

      <div className="no-scrollbar mt-5 hidden gap-1 overflow-x-auto rounded-xl bg-ink-line/40 p-1 sm:flex">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.key;
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
              {item.key === "bookings" && stats.pending > 0 && (
                <span className="rounded-full bg-brand px-1.5 py-0.5 text-[12px] font-bold text-white">
                  {stats.pending}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "dashboard" && (
        <div className="mt-5 space-y-5">
          {/* 오늘 처리할 일 — 입금 확인은 시트까지 2탭 */}
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 pt-4">
              <div>
                <h2 className="text-[15px] font-extrabold text-ink">오늘 처리할 일</h2>
                <p className="mt-0.5 text-[12px] text-ink-mute">
                  입금 확인 {todayQueue.filter((b) => b.status === "pending").length}건 · 환불 처리{" "}
                  {todayQueue.filter((b) => b.refundStatus === "pending").length}건
                </p>
              </div>
              {todayQueue.length > 0 && (
                <span className="ui-badge ui-badge--pay">{todayQueue.length}건 대기</span>
              )}
            </div>

            <div className="mt-2 divide-y divide-ink-line">
              {todayQueue.length === 0 && (
                <div className="px-4 pb-4 pt-3">
                  <p className="text-[13px] font-semibold text-ink">오늘은 처리할 일이 없어요 🎉</p>
                  <p className="mt-0.5 text-[12px] text-ink-mute">
                    손님에게 결제 링크를 보내 두면 예약이 들어올 때 바로 확인할 수 있어요.
                  </p>
                  <button
                    type="button"
                    onClick={() => setTab("links")}
                    className="btn-soft btn-sm mt-2"
                  >
                    <LinkIcon size={14} />
                    링크 공유하기
                  </button>
                </div>
              )}

              {todayQueue.map((booking) => {
                const claimed = Boolean(booking.paidClaimedAt);
                const deadline = booking.expiresAt ? new Date(booking.expiresAt).getTime() : null;
                const remaining = deadline ? deadline - clock : null;
                const urgent = remaining !== null && remaining <= 5 * 60 * 1000;
                const isRefund = booking.status !== "pending" && booking.refundStatus === "pending";
                return (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => setConfirmBooking(booking)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-brand-light/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] text-ink-mute">
                        {formatDate(booking.date)} {formatTime(booking.startTime)} · {booking.spaceName}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
                        <span className="text-[18px] font-extrabold text-ink">{won(booking.totalAmount)}</span>
                        <span className="text-[13px] font-bold text-ink-soft">
                          · {booking.depositorName || booking.guestName}
                        </span>
                      </p>
                      <p
                        className={cn(
                          "mt-0.5 inline-flex items-center gap-1 text-[12px] font-semibold",
                          claimed ? "text-[#1D4ED8]" : urgent ? "text-red-500" : "text-amber-700"
                        )}
                      >
                        {isRefund ? (
                          "환불 처리 필요"
                        ) : claimed ? (
                          <>
                            <HourglassIcon size={12} /> 입금 신고 도착 · 확인만 하면 확정
                          </>
                        ) : (
                          <>
                            <ClockIcon size={12} />
                            {remaining !== null && remaining > 0
                              ? `남은 ${Math.floor(remaining / 60000)}분 · 입금 대기`
                              : "입금 대기"}
                          </>
                        )}
                      </p>
                    </div>
                    <span className="grid h-11 min-w-[84px] shrink-0 place-items-center rounded-xl bg-brand-dark px-3 text-[13px] font-bold text-white">
                      {isRefund ? "환불 처리" : "입금 확인"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl2 border border-brand/20 bg-brand-light p-4">
              <p className="text-[12px] font-semibold text-brand-dark/80">이번 달 예상 매출</p>
              <p className="mt-1 text-2xl font-extrabold text-brand-dark">{wonShort(stats.revenue)}</p>
              <p className="mt-0.5 text-[12px] text-brand-dark/70">확정 예약 {stats.confirmedCount}건 기준</p>
            </div>
            <div className="card p-4">
              <p className="text-[12px] font-semibold text-ink-mute">접수된 예약</p>
              <p className="mt-1 text-2xl font-extrabold text-ink">{stats.pending}건</p>
              <p className="mt-0.5 text-[12px] text-ink-mute">승인 대기 중</p>
            </div>
            <div className="card p-4">
              <p className="text-[12px] font-semibold text-ink-mute">노출 중인 공간</p>
              <p className="mt-1 text-2xl font-extrabold text-ink">{mySpaces.length}개</p>
              <p className="mt-0.5 text-[12px] text-ink-mute">상단 광고 {stats.exposed} · 타임특가 {stats.deals}</p>
            </div>
            <div className="card p-4">
              <p className="text-[12px] font-semibold text-ink-mute">결제 링크로 들어온 예약</p>
              <p className="mt-1 text-2xl font-extrabold text-ink">
                {myBookings.filter((booking) => booking.channel === "link").length}건
              </p>
              <p className="mt-0.5 text-[12px] text-ink-mute">자체 유입 손님</p>
            </div>
          </div>

          <MonthlySavings bookings={myBookings} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
            <section className="card p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-ink">최근 예약</h2>
                <button
                  type="button"
                  onClick={() => setTab("bookings")}
                  className="text-[12px] font-semibold text-ink-mute hover:text-brand-dark"
                >
                  전체 보기
                </button>
              </div>
              <div className="mt-2 divide-y divide-ink-line">
                {myBookings.slice(0, 4).map((booking) => {
                  const meta = bookingStatusMeta(booking);
                  return (
                    <div key={booking.id} className="flex items-center gap-3 py-2.5">
                      <span className={cn("badge shrink-0", meta.style)}>{meta.label}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-ink">
                          {booking.guestName} · {booking.spaceName}
                        </p>
                        <p className="text-[12px] text-ink-mute">
                          {formatDate(booking.date)} {formatTime(booking.startTime)} · {booking.guests}명
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-extrabold text-ink">{wonShort(booking.totalAmount)}</span>
                    </div>
                  );
                })}
                {myBookings.length === 0 && (
                  <p className="py-8 text-center text-xs text-ink-mute">아직 들어온 예약이 없어요.</p>
                )}
              </div>
            </section>

            <section className="card p-4">
              <h2 className="text-sm font-extrabold text-ink">오늘의 운영 팁</h2>
              <ul className="mt-2 space-y-2 text-[12px] leading-relaxed text-ink-soft">
                <li className="flex gap-2">
                  <span className="text-brand-dark">•</span>
                  {stats.pending > 0
                    ? `승인 대기 예약이 ${stats.pending}건 있어요. 빠르게 답할수록 확정률이 올라갑니다.`
                    : "대기 중인 예약이 없어요. 상단 노출을 켜 두면 오늘 저녁 검색 손님을 만날 수 있어요."}
                </li>
                <li className="flex gap-2">
                  <span className="text-brand-dark">•</span>
                  타임특가를 켜 두면 비어 있는 시간대를 채우기 쉬워요.
                </li>
                <li className="flex gap-2">
                  <span className="text-brand-dark">•</span>
                  인스타·블로그 손님에게 예약 링크를 보내면 자체 유입 예약을 바로 받을 수 있어요.
                </li>
              </ul>
              <button
                type="button"
                onClick={() => setTab("links")}
                className="btn-soft btn-sm mt-3 w-full"
              >
                <LinkIcon size={14} />
                결제 링크 만들기
              </button>
            </section>
          </div>

          <section className="relative overflow-hidden rounded-xl2 bg-gradient-to-br from-[#1B1624] via-[#2A1B2C] to-[#4A1F38] p-5 text-white">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="max-w-sm">
                <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-bold">
                  <SparkleIcon size={12} /> 무료 운영 단계
                </p>
                <h2 className="mt-2 text-lg font-extrabold">지금은 수수료 0%로 운영 중이에요</h2>
                <p className="mt-1 text-[12px] text-white/70">
                  플랫폼 예약·전용 결제 링크 모두 수수료 없이 정산됩니다. 정식 오픈 시점과 요율은 사전에 안내드려요.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <MascotAvatar size={64} className="hidden ring-white/30 sm:inline-grid" />
                <span className="rounded-xl bg-white/10 px-4 py-3 text-center">
                  <span className="block text-2xl font-extrabold">0%</span>
                  <span className="block text-[12px] text-white/70">현재 수수료</span>
                </span>
              </div>
            </div>
          </section>
        </div>
      )}

      {tab === "spaces" && (
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-ink">내 공간 <span className="text-brand-dark">{mySpaces.length}</span></h2>
            <button type="button" onClick={openCreate} className="btn-primary btn-sm">
              <PlusIcon size={14} />
              공간 등록
            </button>
          </div>

          {mySpaces.length === 0 ? (
            <div className="card mt-3 flex flex-col items-center gap-2 px-6 py-12 text-center">
              <MascotAvatar size={72} className="animate-floaty" />
              <p className="text-sm font-bold text-ink">아직 등록한 공간이 없어요</p>
              <p className="text-xs text-ink-mute">3분이면 공간을 등록하고 예약을 받을 수 있어요.</p>
              <button type="button" onClick={openCreate} className="btn-primary btn-sm mt-2">
                첫 공간 등록하기
              </button>
            </div>
          ) : (
            <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {mySpaces.map((space) => (
                <article key={space.id} className="card overflow-hidden">
                  <div className="relative h-32">
                    <SpaceMedia space={space} />
                    <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                      <span className={cn("badge", APPROVAL_STYLE[space.approvalStatus])}>
                        {space.approvalStatus === "approved" ? <CheckIcon size={10} /> : <ShieldIcon size={10} />}
                        {APPROVAL_LABEL[space.approvalStatus]}
                      </span>
                      {space.hidden && (
                        <span className="badge bg-slate-700 text-white">
                          <EyeOffIcon size={11} />
                          비공개
                        </span>
                      )}
                      {space.featured && <span className="badge bg-ink text-white">AD 노출중</span>}
                      {space.timeDeal && <span className="badge bg-brand text-white">타임특가</span>}
                    </div>
                  </div>
                  <div className="p-3.5">
                    <p className="text-[12px] text-ink-mute">
                      {CATEGORY_MAP[space.category]?.label} · {space.region} {space.district}
                    </p>
                    <h3 className="mt-0.5 truncate text-sm font-bold text-ink">{space.name}</h3>
                    <p className="mt-1 text-xs text-ink-soft">
                      시간당 <b className="text-ink">{won(space.pricePerHour)}</b>
                      {space.discountRate > 0 && <span className="ml-1 text-brand-dark">−{space.discountRate}%</span>}
                      <span className="ml-1 text-ink-mute">· {space.capacity}명</span>
                    </p>

                    <div className="mt-2.5 space-y-1.5">
                      <Switch
                        checked={space.featured}
                        onChange={(value) => void toggleField(space, "featured", value)}
                        label="공실 광고 · 지역 상단 노출"
                        hint={space.featured ? "검색 상단에 노출 중" : "켜면 내 공간이 가장 먼저 보여요"}
                      />
                      <Switch
                        checked={space.timeDeal}
                        onChange={(value) => void toggleField(space, "timeDeal", value)}
                        label="타임특가 노출"
                        hint={
                          space.discountRate > 0
                            ? `${space.discountRate}% 할인으로 홈 특가 섹션에 노출`
                            : "할인율을 먼저 설정해 주세요"
                        }
                      />
                      <Switch
                        checked={!space.hidden}
                        onChange={(value) => void toggleHidden(space, !value)}
                        label="손님에게 공개"
                        hint={space.hidden ? "지금은 손님 화면에서 숨겨져 있어요" : "홈·검색에 노출 중"}
                      />
                    </div>

                    <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-ink-line/30 px-2.5 py-2">
                      <LinkIcon size={12} className="shrink-0 text-brand-dark" />
                      <span className="min-w-0 flex-1 truncate text-[12px] text-ink-soft">/pay/{space.paySlug}</span>
                      <button
                        type="button"
                        onClick={() => void copy(`${origin}/pay/${space.paySlug}`, "결제 링크를 복사했어요!")}
                        className="shrink-0 rounded-md bg-white px-2 py-1 text-[12px] font-bold text-brand-dark"
                      >
                        복사
                      </button>
                    </div>

                    {space.approvalStatus === "rejected" && (
                      <p className="mt-1.5 rounded-lg bg-red-50 px-2.5 py-2 text-[12px] font-semibold leading-relaxed text-red-600">
                        반려 사유 · {space.rejectionReason || "관리자 안내를 확인해 주세요."}
                      </p>
                    )}
                    {space.approvalStatus === "pending_review" && (
                      <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-[12px] font-semibold leading-relaxed text-amber-700">
                        관리자 확인 중이에요. 승인되면 손님 화면에 공개되고 예약을 받을 수 있어요.
                      </p>
                    )}

                    {spaceAccounts[space.id] ? (
                      <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-2 text-[12px] text-emerald-700">
                        <CheckIcon size={11} className="shrink-0" />
                        <span className="min-w-0 truncate font-semibold">
                          입금 계좌 · {spaceAccounts[space.id].bankName} {spaceAccounts[space.id].accountNumber}
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openEdit(space)}
                        className="mt-1.5 flex w-full items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-left text-[12px] font-semibold text-amber-700 transition hover:bg-amber-100"
                      >
                        <span className="shrink-0">⚠️</span>
                        <span className="min-w-0 flex-1">입금 계좌 미등록 · 손님에게 입금 안내가 나가지 않아요</span>
                        <span className="shrink-0 underline">등록</span>
                      </button>
                    )}

                    <div className="mt-2.5 flex gap-2">
                      <button type="button" onClick={() => openEdit(space)} className="btn-ghost btn-sm flex-1">
                        수정
                      </button>
                      <Link href={`/spaces/${space.id}`} className="btn-soft btn-sm flex-1">
                        미리보기
                      </Link>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(space.id)}
                        className="btn-sm rounded-lg border border-ink-line px-2.5 text-xs font-semibold text-ink-mute hover:border-red-200 hover:text-red-500"
                      >
                        삭제
                      </button>
                    </div>
                    {confirmDelete === space.id && (
                      <div className="mt-2 rounded-lg bg-red-50 p-2.5">
                        <p className="text-[12px] font-semibold text-red-700">이 공간을 삭제할까요? 예약 내역도 함께 숨겨져요.</p>
                        <div className="mt-1.5 flex gap-1.5">
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteSpace(space.id);
                              void deleteSpacePhotos(space.imageUrls);
                              setConfirmDelete(null);
                              setToast("공간을 삭제했어요.");
                            }}
                            className="rounded-md bg-red-500 px-2.5 py-1 text-[12px] font-bold text-white"
                          >
                            삭제
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(null)}
                            className="rounded-md bg-white px-2.5 py-1 text-[12px] font-bold text-ink-soft"
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "bookings" && (
        <div className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-extrabold text-ink">
              예약 관리 <span className="text-brand-dark">{myBookings.length}</span>
            </h2>
            <p className="text-[12px] text-ink-mute">승인 대기 {stats.pending}건 · 확정 {stats.confirmedCount}건</p>
          </div>

          <div className="mt-3 space-y-3">
            {myBookings.length === 0 ? (
              <div className="card flex flex-col items-center gap-2 px-6 py-14 text-center">
                <CalendarIcon size={30} className="text-brand-dark/60" />
                <p className="text-sm font-bold text-ink">아직 접수된 예약이 없어요</p>
                <p className="text-xs text-ink-mute">결제 링크를 손님에게 보내면 예약이 바로 들어와요.</p>
              </div>
            ) : (
              myBookings.map((booking) => {
                const meta = bookingStatusMeta(booking);
                return (
                <article key={booking.id} className="card p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={cn("badge", meta.style)}>{meta.label}</span>
                        {booking.channel === "link" && (
                          <span className="badge bg-brand-light text-brand-dark">
                            <LinkIcon size={11} />
                            결제 링크
                          </span>
                        )}
                        {booking.status === "cancelled" && booking.refundStatus !== "none" && (
                          <span className={cn("badge", REFUND_STYLE[booking.refundStatus])}>
                            {REFUND_LABEL[booking.refundStatus]}
                          </span>
                        )}
                        <span className="text-[12px] text-ink-mute">No. {shortId(booking.id)}</span>
                        <span className="text-[12px] text-ink-mute">· {formatRelativeDate(booking.createdAt)}</span>
                      </div>
                      <h3 className="mt-1.5 text-sm font-bold text-ink">{booking.spaceName}</h3>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink-soft">
                        <span className="inline-flex items-center gap-1">
                          <CalendarIcon size={12} className="text-ink-mute" />
                          {formatDate(booking.date)} {formatTime(booking.startTime)} ~ {endTime(booking.startTime, booking.hours)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <UsersIcon size={12} className="text-ink-mute" />
                          {booking.guests}명 · {booking.hours}시간
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-ink-line/30 px-2.5 py-2 text-[12px]">
                        <span className="font-semibold text-ink">{booking.guestName}</span>
                        <a href={`tel:${booking.guestPhone}`} className="text-ink-soft hover:text-brand-dark">
                          {booking.guestPhone}
                        </a>
                        {booking.memo && <span className="text-ink-mute">요청: {booking.memo}</span>}
                      </div>

                      <DepositInfoRow booking={booking} className="mt-2" />

                      <BookingTimeline
                        events={bookingEvents.filter((event) => event.bookingId === booking.id)}
                      />
                    </div>

                    <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
                      <p className="text-base font-extrabold text-ink">{won(booking.totalAmount)}</p>
                      <div className="flex gap-1.5">
                        {booking.status === "pending" && (
                          <>
                            <button
                              type="button"
                              disabled={busyBooking === booking.id}
                              onClick={() => void handleBooking(booking.id, "confirmed")}
                              className="h-11 min-w-[104px] rounded-xl bg-brand-dark px-4 text-[14px] font-bold text-white shadow-sm hover:bg-brand-deep disabled:opacity-60"
                            >
                              입금 확인(확정)
                            </button>
                            <button
                              type="button"
                              disabled={busyBooking === booking.id}
                              onClick={() => void handleBooking(booking.id, "cancelled")}
                              className="h-11 min-w-[88px] rounded-xl border border-ink-line px-4 text-[14px] font-bold text-ink-soft hover:border-red-200 hover:text-red-500 disabled:opacity-60"
                            >
                              예약 거절
                            </button>
                          </>
                        )}
                        {booking.status === "confirmed" && (
                          <button
                            type="button"
                            disabled={busyBooking === booking.id}
                            onClick={() => void handleBooking(booking.id, "cancelled")}
                            className="h-11 min-w-[88px] rounded-xl border border-ink-line px-4 text-[14px] font-bold text-ink-soft hover:border-red-200 hover:text-red-500 disabled:opacity-60"
                          >
                            예약 취소
                          </button>
                        )}
                        {booking.status === "cancelled" && booking.refundStatus === "pending" && (
                          <button
                            type="button"
                            disabled={busyBooking === booking.id}
                            onClick={async () => {
                              setBusyBooking(booking.id);
                              try {
                                await updateRefund(booking.id, "completed", "사장님 계좌 환불 완료");
                                setToast("환불 완료로 처리했어요.");
                              } catch (err) {
                                setToast(err instanceof Error ? err.message : "환불 처리를 하지 못했어요.");
                              } finally {
                                setBusyBooking(null);
                              }
                            }}
                            className="h-11 min-w-[104px] rounded-xl bg-amber-500 px-4 text-[14px] font-bold text-white hover:bg-amber-600 disabled:opacity-60"
                          >
                            환불 완료 처리
                          </button>
                        )}
                        {booking.status === "cancelled" && booking.refundStatus === "none" && (
                          <span className="text-[12px] text-ink-mute">
                            {booking.cancelReason === "expired" ? "입금 기한 만료로 자동 취소" : "종료된 예약"}
                          </span>
                        )}
                        {booking.status === "cancelled" && booking.refundStatus === "completed" && (
                          <span className="text-[12px] font-semibold text-emerald-600">환불 완료</span>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
                );
              })
            )}
          </div>
        </div>
      )}

      {tab === "schedule" && (
        <div className="mt-5 space-y-4">
          <section className="card p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-light text-brand-dark">
                <ClockIcon size={18} />
              </span>
              <div>
                <h2 className="text-sm font-extrabold text-ink">사장님 시간 차단</h2>
                <p className="text-[12px] text-ink-mute">
                  예약을 받고 싶지 않은 시간대를 막아 두면 손님 화면에서 선택할 수 없어요.
                </p>
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <div className="lg:col-span-2">
                <label className="label" htmlFor="block-space">공간</label>
                <select
                  id="block-space"
                  value={blockForm.spaceId}
                  onChange={(event) => setBlockForm({ ...blockForm, spaceId: event.target.value })}
                  className="input"
                  disabled={mySpaces.length === 0}
                >
                  {mySpaces.map((space) => (
                    <option key={space.id} value={space.id}>
                      {space.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="block-date">날짜</label>
                <input
                  id="block-date"
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={blockForm.date}
                  onChange={(event) => setBlockForm({ ...blockForm, date: event.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor="block-start">시작</label>
                <select
                  id="block-start"
                  value={blockForm.startTime}
                  onChange={(event) => setBlockForm({ ...blockForm, startTime: event.target.value })}
                  className="input"
                >
                  {Array.from({ length: 15 }, (_, i) => String(8 + i).padStart(2, "0") + ":00").map((slot) => (
                    <option key={slot} value={slot}>
                      {formatTime(slot)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="block-hours">시간</label>
                <select
                  id="block-hours"
                  value={blockForm.hours}
                  onChange={(event) => setBlockForm({ ...blockForm, hours: Number(event.target.value) })}
                  className="input"
                >
                  {[1, 2, 3, 4, 5, 6, 8].map((hour) => (
                    <option key={hour} value={hour}>
                      {hour}시간
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                value={blockForm.memo}
                onChange={(event) => setBlockForm({ ...blockForm, memo: event.target.value })}
                placeholder="메모 (선택) · 예: 정기 청소, 사장님 개인 일정"
                className="input"
              />
              <button
                type="button"
                disabled={blockBusy || !blockForm.spaceId || !blockForm.date}
                onClick={async () => {
                  setBlockError("");
                  setBlockBusy(true);
                  try {
                    await createBlock({
                      spaceId: blockForm.spaceId,
                      date: blockForm.date,
                      startTime: blockForm.startTime,
                      hours: blockForm.hours,
                      memo: blockForm.memo,
                    });
                    setToast("그 시간대를 차단했어요. 손님 화면에서 선택할 수 없어요.");
                    setBlockForm({ ...blockForm, memo: "" });
                  } catch (err) {
                    setBlockError(err instanceof Error ? err.message : "시간을 차단하지 못했어요.");
                  } finally {
                    setBlockBusy(false);
                  }
                }}
                className="btn-primary px-4"
              >
                {blockBusy ? "차단 중…" : "시간 차단"}
              </button>
            </div>
            {blockError && (
              <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-[12px] font-medium text-red-600">{blockError}</p>
            )}
          </section>

          <PasteImporter
            mySpaces={mySpaces}
            spaceId={blockForm.spaceId}
            onSpaceChange={(id) => setBlockForm((prev) => ({ ...prev, spaceId: id }))}
            onToast={setToast}
          />

          <IcalPanel mySpaces={mySpaces} onToast={setToast} />

          <section className="card p-4 sm:p-5">
            <h2 className="text-sm font-extrabold text-ink">
              차단 중인 시간 <span className="text-brand-dark">{myBlocks.length}</span>
            </h2>
            <div className="mt-2 divide-y divide-ink-line">
              {myBlocks.length === 0 ? (
                <p className="py-6 text-center text-[12px] text-ink-mute">아직 차단한 시간이 없어요.</p>
              ) : (
                myBlocks.map((block) => (
                  <div key={block.id} className="flex flex-wrap items-center gap-2 py-2.5">
                    <span className="badge bg-slate-100 text-slate-600">차단</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-ink">{block.spaceName}</p>
                      <p className="text-[12px] text-ink-mute">
                        {formatDate(block.date)} {formatTime(block.startTime)} ~ {formatTime(endTime(block.startTime, block.hours))}
                        {block.memo ? ` · ${block.memo}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await releaseBlock(block.id);
                          setToast("차단을 해제했어요. 다시 예약을 받을 수 있어요.");
                        } catch (err) {
                          setToast(err instanceof Error ? err.message : "차단을 해제하지 못했어요.");
                        }
                      }}
                      className="h-11 rounded-xl border border-ink-line px-4 text-[14px] font-bold text-ink-soft hover:border-brand hover:text-brand-dark"
                    >
                      차단 해제
                    </button>
                  </div>
                ))
              )}
            </div>
            <p className="mt-2 rounded-lg bg-ink-line/30 px-2.5 py-2 text-[12px] leading-relaxed text-ink-mute">
              차단한 시간은 예약과 똑같이 중복 예약이 막히고, 매출·정산 집계에서는 제외돼요.
            </p>
          </section>
        </div>
      )}

      {tab === "links" && (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <section className="card p-5">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-light text-brand-dark">
                <BoltIcon size={18} />
              </span>
              <div>
                <h2 className="text-sm font-extrabold text-ink">간편 결제 링크 1초 생성기</h2>
                <p className="text-[12px] text-ink-mute">인스타 DM·카톡으로 보내면 손님이 바로 예약·결제해요.</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="label" htmlFor="link-space">
                  공간 선택
                </label>
                <select
                  id="link-space"
                  value={selectedLinkSpace?.id ?? ""}
                  onChange={(event) => setLinkSpaceId(event.target.value)}
                  className="input"
                  disabled={mySpaces.length === 0}
                >
                  {mySpaces.map((space) => (
                    <option key={space.id} value={space.id}>
                      {space.name}
                    </option>
                  ))}
                  {mySpaces.length === 0 && <option value="">먼저 공간을 등록해 주세요</option>}
                </select>
              </div>

              <div>
                <label className="label" htmlFor="link-url">
                  전용 결제·예약 링크
                </label>
                <div className="flex gap-2">
                  <input id="link-url" readOnly value={payLink} className="input bg-ink-line/20 text-[12px]" />
                  <button
                    type="button"
                    disabled={!payLink}
                    onClick={() => void copy(payLink, "결제 링크를 복사했어요!")}
                    className="btn-primary shrink-0 px-3"
                  >
                    <CopyIcon size={15} />
                    복사
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedLinkSpace && (
                  <Link href={`/pay/${selectedLinkSpace.paySlug}`} target="_blank" className="btn-ghost btn-sm">
                    <LinkIcon size={13} />
                    링크 열어보기
                  </Link>
                )}
                <button
                  type="button"
                  disabled={!dmText}
                  onClick={() => void copy(dmText, "인스타 DM 문구를 복사했어요!")}
                  className="btn-soft btn-sm"
                >
                  DM 문구 복사
                </button>
              </div>

              <QrShare url={payLink} spaceName={selectedLinkSpace?.name ?? ""} onToast={setToast} />

              {mode === "demo" && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-700">
                  미리보기 모드에서는 링크가 이 브라우저에서만 열려요. Supabase를 연결하면 손님 기기에서도 그대로
                  열립니다.
                </p>
              )}

              {selectedLinkSpace && (
                <div className="rounded-xl bg-ink-line/30 p-3 text-[12px] leading-relaxed text-ink-soft">
                  <p className="font-bold text-ink">{selectedLinkSpace.name}</p>
                  <p className="mt-0.5">
                    시간당 {won(selectedLinkSpace.pricePerHour)}
                    {selectedLinkSpace.discountRate > 0 && (
                      <span className="text-brand-dark"> → {won(
                        Math.round((selectedLinkSpace.pricePerHour * (100 - selectedLinkSpace.discountRate)) / 100)
                      )} ({selectedLinkSpace.discountRate}% 할인)</span>
                    )}
                  </p>
                  <p className="mt-1 text-ink-mute">
                    손님은 이름·연락처만 입력하면 예약 신청이 끝나고, 사장님 센터에 바로 접수돼요.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl2 bg-gradient-to-br from-brand to-brand-dark p-5 text-white">
            <span className="badge bg-white/15 text-white">
              <SparkleIcon size={12} />
              자체 유입 손님 수수료 0%
            </span>
            <h2 className="mt-3 text-lg font-extrabold leading-snug">
              내가 데려온 손님은
              <br />
              전용 링크로 받으세요
            </h2>
            <p className="mt-2 text-[12px] leading-relaxed text-white/80">
              전용 링크로 들어온 예약은 사장님 센터에 바로 접수되고, 확정·결제 안내까지 한 번에 관리할 수 있어요.
              공간별로 링크가 자동 발급되어 인스타 프로필·블로그에 그대로 붙여 넣으면 됩니다.
            </p>
            <div className="mt-4 space-y-2 text-[12px]">
              {[
                "공간별 전용 링크 자동 발급",
                "손님은 로그인 없이 이름·연락처만으로 예약 요청",
                "예약 접수 → 승인 → 정산까지 한 곳에서",
              ].map((item) => (
                <p key={item} className="flex items-center gap-1.5">
                  <CheckIcon size={13} />
                  {item}
                </p>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void copy(dmText, "DM 문구를 복사했어요!")}
              disabled={!dmText}
              className="btn mt-4 w-full bg-white text-brand-dark hover:bg-brand-light"
            >
              <CopyIcon size={15} />
              인스타 DM 문구 복사
            </button>
          </section>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[92dvh] w-full max-w-lg animate-pop-in overflow-y-auto rounded-t-2xl bg-white p-5 shadow-float sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold text-ink">{editing ? "공간 수정" : "내 공간 등록"}</h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-ink-mute hover:bg-ink-line/60"
                aria-label="닫기"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <form onSubmit={submitForm} className="mt-4 space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="label mb-0">공간 사진</span>
                  <span className="text-[12px] font-semibold text-ink-mute">
                    {form.photos.length}/{MAX_PHOTOS}장
                  </span>
                </div>
                <input
                  id="space-photos"
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => void addPhotos(event.target.files)}
                />
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {form.photos.map((url, index) => (
                    <div
                      key={url}
                      className="group relative aspect-square overflow-hidden rounded-lg border border-ink-line bg-ink-line/30"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`공간 사진 ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                      {index === 0 ? (
                        <span className="absolute left-1 top-1 rounded bg-ink/80 px-1.5 py-0.5 text-[12px] font-bold text-white">
                          대표
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => makeCoverPhoto(url)}
                          className="absolute inset-x-1 bottom-1 h-8 rounded bg-white/90 px-1 text-[12px] font-bold text-ink-soft transition sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          대표로
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removePhoto(url)}
                        className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-full bg-ink/70 text-white transition hover:bg-brand"
                        aria-label="사진 삭제"
                      >
                        <CloseIcon size={11} />
                      </button>
                    </div>
                  ))}
                  {form.photos.length < MAX_PHOTOS && (
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={uploading}
                      className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-brand/40 bg-brand-light/40 text-[12px] font-bold text-brand-dark transition hover:border-brand disabled:opacity-60"
                    >
                      {uploading ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
                          올리는 중…
                        </>
                      ) : (
                        <>
                          <PhotoIcon size={18} />
                          사진 추가
                        </>
                      )}
                    </button>
                  )}
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-ink-mute">
                  첫 번째 사진이 대표 사진으로 보여요. JPG·PNG·WebP · 최대 {MAX_PHOTOS}장
                </p>
                {photoError && (
                  <p className="mt-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-[12px] font-medium text-red-500">
                    {photoError}
                  </p>
                )}
              </div>

              <div>
                <label className="label" htmlFor="space-name">공간 이름 *</label>
                <input
                  id="space-name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="예: 성수 루프탑 라운지"
                  className="input"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label" htmlFor="space-category">카테고리</label>
                  <select
                    id="space-category"
                    value={form.category}
                    onChange={(event) => setForm({ ...form, category: event.target.value as Category })}
                    className="input"
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category.key} value={category.key}>
                        {category.emoji} {category.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="space-region">지역</label>
                  <select
                    id="space-region"
                    value={form.region}
                    onChange={(event) => setForm({ ...form, region: event.target.value })}
                    className="input"
                  >
                    {REGIONS.map((region) => (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label" htmlFor="space-district">시/군/구</label>
                  <input
                    id="space-district"
                    value={form.district}
                    onChange={(event) => setForm({ ...form, district: event.target.value })}
                    placeholder="성동구"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="space-address">주소</label>
                  <input
                    id="space-address"
                    value={form.address}
                    onChange={(event) => setForm({ ...form, address: event.target.value })}
                    placeholder="서울 성동구 성수이로 118"
                    className="input"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-ink-line bg-ink-line/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-extrabold text-ink">확정 후에만 공개되는 정보</p>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[12px] font-bold text-ink-mute">🔒 예약 확정 손님만</span>
                </div>
                <p className="mt-0.5 text-[12px] leading-relaxed text-ink-mute">
                  공개 화면에는 동네까지만 보여요. 입금이 확인돼 예약이 확정되면 아래 정보가 예약자에게 열립니다.
                </p>
                <div className="mt-2">
                  <label className="label" htmlFor="space-detail-address">상세주소</label>
                  <input
                    id="space-detail-address"
                    value={form.detailAddress}
                    onChange={(event) => setForm({ ...form, detailAddress: event.target.value })}
                    placeholder="서울 성동구 성수이로 118, 5층 502호"
                    className="input"
                  />
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="space-entry">출입 안내</label>
                    <textarea
                      id="space-entry"
                      value={form.entryGuide}
                      onChange={(event) => setForm({ ...form, entryGuide: event.target.value })}
                      rows={2}
                      placeholder="건물 1층 로비에서 502호 초인종을 눌러 주세요. 도어락 비밀번호는 1234*"
                      className="input resize-none"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="space-parking">주차 안내</label>
                    <textarea
                      id="space-parking"
                      value={form.parkingGuide}
                      onChange={(event) => setForm({ ...form, parkingGuide: event.target.value })}
                      rows={2}
                      placeholder="건물 뒤편 기계식 주차장 2대 무료 (차량 번호 사전 등록)"
                      className="input resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="label" htmlFor="space-price">시간당 가격 *</label>
                  <input
                    id="space-price"
                    value={form.price}
                    onChange={(event) => setForm({ ...form, price: event.target.value })}
                    placeholder="38000"
                    inputMode="numeric"
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="space-capacity">최대 인원</label>
                  <input
                    id="space-capacity"
                    value={form.capacity}
                    onChange={(event) => setForm({ ...form, capacity: event.target.value })}
                    placeholder="10"
                    inputMode="numeric"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="space-discount">할인율 %</label>
                  <input
                    id="space-discount"
                    value={form.discount}
                    onChange={(event) => setForm({ ...form, discount: event.target.value })}
                    placeholder="0"
                    inputMode="numeric"
                    className="input"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-brand/20 bg-brand-light/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-extrabold text-ink">입금 받을 계좌</p>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[12px] font-bold text-brand-dark">15분 입금 확인</span>
                </div>
                <p className="mt-0.5 text-[12px] leading-relaxed text-ink-mute">
                  손님이 예약하면 이 계좌로 이용 요금을 입금합니다. 15분 안에 입금되지 않으면 예약은 자동으로 풀려요.
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <label className="label" htmlFor="space-bank">
                      은행
                    </label>
                    <input
                      id="space-bank"
                      value={form.bankName}
                      onChange={(event) => setForm({ ...form, bankName: event.target.value })}
                      placeholder="국민은행"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="space-holder">
                      예금주
                    </label>
                    <input
                      id="space-holder"
                      value={form.accountHolder}
                      onChange={(event) => setForm({ ...form, accountHolder: event.target.value })}
                      placeholder="박기남"
                      className="input"
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <label className="label" htmlFor="space-account">
                    계좌번호
                  </label>
                  <input
                    id="space-account"
                    value={form.accountNumber}
                    onChange={(event) => setForm({ ...form, accountNumber: event.target.value })}
                    placeholder="123-45-678901"
                    inputMode="numeric"
                    className="input"
                  />
                </div>
                {!form.bankName.trim() && !form.accountNumber.trim() && !form.accountHolder.trim() && (
                  <p className="mt-1.5 text-[12px] font-medium text-amber-700">
                    계좌를 비워 두면 손님 예약 화면에는 &ldquo;계좌 미등록&rdquo; 안내가 나가요.
                  </p>
                )}
                {editing && (
                  <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[12px] font-medium leading-relaxed text-amber-700">
                    🛡️ 입금 계좌를 바꾸면 계좌 바꿔치기 사기를 막기 위해 <b>관리자 재승인 전까지</b> 공개·새 예약이
                    잠시 멈춰요.
                  </p>
                )}
              </div>

              <div>
                <label className="label" htmlFor="space-amenities">제공 시설 (쉼표로 구분)</label>
                <input
                  id="space-amenities"
                  value={form.amenities}
                  onChange={(event) => setForm({ ...form, amenities: event.target.value })}
                  placeholder="와이파이, 주차, 빔프로젝터"
                  className="input"
                />
              </div>

              <div>
                <label className="label" htmlFor="space-description">공간 설명</label>
                <textarea
                  id="space-description"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  rows={3}
                  placeholder="공간의 분위기, 잘 어울리는 모임, 이용 안내를 적어주세요."
                  className="input resize-none"
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Switch
                  checked={form.featured}
                  onChange={(value) => setForm({ ...form, featured: value })}
                  label="상단 노출 광고"
                  hint="지역 검색 상단에 노출해요"
                />
                <Switch
                  checked={form.timeDeal}
                  onChange={(value) => setForm({ ...form, timeDeal: value })}
                  label="타임특가 노출"
                  hint="홈 특가 섹션에 노출해요"
                />
                <Switch
                  checked={!form.hidden}
                  onChange={(value) => setForm({ ...form, hidden: !value })}
                  label="공개 상태"
                  hint="끄면 손님 화면에서 숨겨요"
                />
              </div>

              {formError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] font-medium text-red-600">{formError}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost flex-1">
                  취소
                </button>
                <button type="submit" disabled={saving || uploading} className="btn-primary flex-1">
                  {uploading ? "사진 올리는 중…" : saving ? "저장 중…" : editing ? "수정 완료" : "공간 등록"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 입금 확인·환불 처리 시트 — 큐에서 한 번 누르고 여기서 한 번 더 누르면 끝(2탭) */}
      {confirmBooking && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-md animate-pop-in rounded-t-2xl bg-white p-5 shadow-float sm:rounded-2xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-[17px] font-extrabold text-ink">
                  {confirmBooking.status === "pending" ? "입금을 확인할까요?" : "환불을 처리했나요?"}
                </h2>
                <p className="mt-0.5 text-[12px] text-ink-mute">
                  {confirmBooking.status === "pending"
                    ? "통장 거래내역과 아래 이름·금액을 대조해 주세요."
                    : "손님 계좌로 환불을 보낸 뒤 표시해 주세요."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmBooking(null)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-ink-mute hover:bg-ink-line/60"
                aria-label="닫기"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <div className="mt-3 rounded-2xl bg-brand-light/70 px-4 py-3">
              <p className="text-[12px] font-semibold text-ink-mute">
                {confirmBooking.spaceName} · {formatDate(confirmBooking.date)} {formatTime(confirmBooking.startTime)}
              </p>
              <p className="mt-1 text-[24px] font-extrabold leading-tight text-ink">{won(confirmBooking.totalAmount)}</p>
              <p className="mt-0.5 text-[14px] font-bold text-ink-soft">
                입금자명 · {confirmBooking.depositorName || confirmBooking.guestName}
              </p>
            </div>

            <p className="mt-3 text-[12px] leading-relaxed text-ink-mute">
              {confirmBooking.status === "pending"
                ? "확인하면 예약이 확정되고 손님의 예약 내역에 바로 반영돼요."
                : "표시하면 예약 관리 목록에서 '환불 완료'로 바뀝니다."}
            </p>

            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setConfirmBooking(null)} className="btn-ghost flex-1 py-3">
                닫기
              </button>
              <button
                type="button"
                disabled={busyBooking === confirmBooking.id}
                onClick={async () => {
                  const target = confirmBooking;
                  if (target.status === "pending") {
                    await handleBooking(target.id, "confirmed");
                  } else {
                    setBusyBooking(target.id);
                    try {
                      await updateRefund(target.id, "completed", "사장님 계좌 환불 완료");
                      setToast("환불 완료로 처리했어요.");
                    } catch (err) {
                      setToast(err instanceof Error ? err.message : "환불 처리를 하지 못했어요.");
                    } finally {
                      setBusyBooking(null);
                    }
                  }
                  setConfirmBooking(null);
                }}
                className="flex-1 rounded-xl bg-brand-dark py-3 text-[15px] font-bold text-white disabled:opacity-60"
              >
                {busyBooking === confirmBooking.id
                  ? "처리 중…"
                  : confirmBooking.status === "pending"
                    ? "입금 확인 완료"
                    : "환불 완료 표시"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="ui-toast text-white">
          {toast}
        </div>
      )}

      {/* 모바일 하단 탭 — 360px에서도 4개가 한 번에 보인다 */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        <div className="grid grid-cols-4">
          {MOBILE_TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[12px] font-semibold transition",
                  active ? "text-brand-dark" : "text-ink-mute"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={22} />
                {item.label}
                {item.key === "bookings" && stats.pending > 0 && (
                  <span className="absolute mt-0 -translate-y-9 translate-x-4 rounded-full bg-brand px-1.5 text-[12px] font-bold text-white">
                    {stats.pending}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {tab === "spaces" && mySpaces.length > 0 && mode === "demo" && (
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => {
              if (window.confirm("미리보기 데이터를 처음 상태로 되돌릴까요? 이 브라우저에 저장된 계정·공간·예약이 초기화됩니다.")) {
                reset();
                setToast("미리보기 데이터를 초기화했어요.");
              }
            }}
            className="text-[12px] font-semibold text-ink-mute underline-offset-2 hover:text-brand-dark hover:underline"
          >
            미리보기 데이터 초기화
          </button>
        </div>
      )}
    </div>
  );
}
