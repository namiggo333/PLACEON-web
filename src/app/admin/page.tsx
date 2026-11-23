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
  CopyIcon,
  PlusIcon,
  SearchIcon,
  ShieldIcon,
  SparkleIcon,
  StoreIcon,
  TrashIcon,
  UsersIcon,
} from "@/components/Icons";
import { isAdminEmail } from "@/lib/admin";
import {
  APPROVAL_LABEL,
  APPROVAL_STYLE,
  CATEGORY_MAP,
  ITEM_CATEGORIES,
  ITEM_CATEGORY_MAP,
  ITEM_LOW_STOCK,
  ITEM_PRODUCT_STATUSES,
  ITEM_PRODUCT_STATUS_MAP,
  ITEM_WAITLIST_STATUSES,
  REFUND_LABEL,
  REFUND_STYLE,
  bookingStatusMeta,
  itemCategoryLabel,
  itemSpaceTypeLabel,
} from "@/lib/constants";
import { DepositInfoRow } from "@/components/DepositInfoRow";
import {
  createItemProduct,
  fetchAdminData,
  patchSpace,
  removeItemProduct,
  removeItemWaitlist,
  removeSpace,
  setSpaceApproval,
  updateBookingStatus,
  updateItemProduct,
  updateItemWaitlistEntry,
  updateRefundStatus,
  type AdminData,
} from "@/lib/db";
import { BookingTimeline } from "@/components/BookingAccess";
import { revalidateHomeCache } from "@/lib/revalidate";
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
import { countsForRevenue, type ApprovalStatus, type Booking, type BookingStatus, type Category, type ItemProduct, type ItemProductStatus, type ItemWaitlistEntry, type ItemWaitlistStatus, type Space } from "@/lib/types";

type TabKey = "spaces" | "bookings" | "members" | "item";

const TABS: { key: TabKey; label: string; icon: typeof StoreIcon }[] = [
  { key: "spaces", label: "입점 공간 관리", icon: StoreIcon },
  { key: "bookings", label: "예약 현황", icon: CalendarIcon },
  { key: "members", label: "사장님·회원", icon: UsersIcon },
  { key: "item", label: "Item 관리", icon: SparkleIcon },
];

/** 관리자 상품 등록·수정 폼 (입력값은 문자열로 들고 있다가 저장할 때 숫자로 바꿈) */
interface ProductDraft {
  name: string;
  category: string;
  description: string;
  price: string;
  unit: string;
  stock: string;
  status: ItemProductStatus;
  imageUrl: string;
}

const EMPTY_PRODUCT: ProductDraft = {
  name: "",
  category: ITEM_CATEGORIES[0]?.key ?? "supplies",
  description: "",
  price: "",
  unit: "",
  stock: "0",
  status: "active",
  imageUrl: "",
};

function draftFromProduct(product: ItemProduct): ProductDraft {
  return {
    name: product.name,
    category: product.category,
    description: product.description,
    price: String(product.price),
    unit: product.unit,
    stock: String(product.stock),
    status: product.status,
    imageUrl: product.imageUrl ?? "",
  };
}

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

/** Item 수요조사 접수 시각 (월.일 시:분) */
function receivedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")} ${String(
    date.getHours()
  ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function prettyContact(entry: ItemWaitlistEntry): string {
  if (entry.contactType === "email") return entry.contact;
  return entry.contact.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3");
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
        <span className="block text-[12px] font-bold text-ink">{label}</span>
        {hint && <span className="mt-0.5 block truncate text-[12px] text-ink-mute">{hint}</span>}
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
      <p className={cn("text-[12px] font-semibold", tone === "brand" ? "text-brand-dark/80" : "text-ink-mute")}>
        {label}
      </p>
      <p className={cn("mt-1 text-2xl font-extrabold", tone === "brand" ? "text-brand-dark" : "text-ink")}>{value}</p>
      <p className={cn("mt-0.5 text-[12px]", tone === "brand" ? "text-brand-dark/70" : "text-ink-mute")}>{hint}</p>
    </div>
  );
}

export default function AdminPage() {
  const { ready, mode, user, bookingEvents, refresh } = useApp();
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
  const [itemQuery, setItemQuery] = useState("");
  const [itemView, setItemView] = useState<"products" | "waitlist">("products");
  const [waitlistFilter, setWaitlistFilter] = useState<ItemWaitlistStatus | "all">("all");
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [productEditing, setProductEditing] = useState<string | null>(null);
  const [productDraft, setProductDraft] = useState<ProductDraft>(EMPTY_PRODUCT);
  const [productError, setProductError] = useState("");
  const [productSaving, setProductSaving] = useState(false);
  const [confirmProductDelete, setConfirmProductDelete] = useState<string | null>(null);
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});
  const [memoDrafts, setMemoDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [approvalFilter, setApprovalFilter] = useState<ApprovalStatus | "all">("all");
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

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
      .filter((booking) => countsForRevenue(booking))
      .reduce((sum, booking) => sum + booking.totalAmount, 0);
    const hosts = profiles.filter((profile) => profile.role === "host").length;
    const guests = profiles.filter((profile) => profile.role === "guest").length;
    const itemWaitlist = data?.itemWaitlist ?? [];
    const itemProducts = data?.itemProducts ?? [];
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
      pendingApproval: spaces.filter((space) => space.approvalStatus !== "approved").length,
      profiles: profiles.length,
      hosts,
      guests,
      itemWaitlist: itemWaitlist.length,
      itemPending: itemWaitlist.filter((entry) => entry.status === "new").length,
      itemProducts: itemProducts.length,
      itemStockLow: itemProducts.filter(
        (product) =>
          product.status !== "hidden" && (product.status === "soldout" || product.stock <= ITEM_LOW_STOCK)
      ).length,
      itemActive: itemProducts.filter((product) => product.status === "active").length,
      itemHidden: itemProducts.filter((product) => product.status === "hidden").length,
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
      if (approvalFilter !== "all" && space.approvalStatus !== approvalFilter) return false;
      if (category !== "all" && space.category !== category) return false;
      if (!query) return true;
      return [space.name, space.hostName, space.region, space.district, space.address]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [data, spaceQuery, category, approvalFilter]);

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

  const filteredWaitlist = useMemo(() => {
    const query = itemQuery.trim().toLowerCase();
    return (data?.itemWaitlist ?? []).filter((entry) => {
      if (waitlistFilter !== "all" && entry.status !== waitlistFilter) return false;
      if (!query) return true;
      return [
        entry.contact,
        entry.customItem,
        entry.note,
        entry.adminMemo,
        entry.budgetOrQty,
        itemSpaceTypeLabel(entry.spaceType),
        ...entry.categories.map(itemCategoryLabel),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [data, itemQuery, waitlistFilter]);

  const waitlistStatusCounts = useMemo(() => {
    const counts = { all: 0, new: 0, contacted: 0, done: 0 };
    for (const entry of data?.itemWaitlist ?? []) {
      counts.all += 1;
      counts[entry.status] += 1;
    }
    return counts;
  }, [data]);

  /** Item 수요조사 카테고리별 신청 수 — 어떤 품목부터 입고할지 판단하는 데 쓴다. */
  const itemDemand = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of data?.itemWaitlist ?? []) {
      for (const key of entry.categories) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return ITEM_CATEGORIES.map((item) => ({ ...item, count: counts.get(item.key) ?? 0 })).sort(
      (a, b) => b.count - a.count
    );
  }, [data]);

  const itemNoticeCount = useMemo(
    () => (data?.itemWaitlist ?? []).filter((entry) => entry.wantsNotice).length,
    [data]
  );

  async function deleteWaitlist(entry: ItemWaitlistEntry) {
    setBusyId(entry.id);
    try {
      await removeItemWaitlist(entry.id);
      setData((prev) =>
        prev ? { ...prev, itemWaitlist: prev.itemWaitlist.filter((item) => item.id !== entry.id) } : prev
      );
      setConfirmDelete(null);
      setToast("수요조사 신청을 삭제했어요.");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "삭제에 실패했어요.");
    } finally {
      setBusyId(null);
    }
  }

  /* ---------------- Item 상품·재고 ---------------- */

  function replaceProduct(product: ItemProduct) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            itemProducts: prev.itemProducts.some((item) => item.id === product.id)
              ? prev.itemProducts.map((item) => (item.id === product.id ? product : item))
              : [product, ...prev.itemProducts],
          }
        : prev
    );
  }

  function openProductForm(product?: ItemProduct) {
    setProductError("");
    setProductEditing(product?.id ?? null);
    setProductDraft(product ? draftFromProduct(product) : { ...EMPTY_PRODUCT });
    setProductFormOpen(true);
  }

  function closeProductForm() {
    setProductEditing(null);
    setProductFormOpen(false);
    setProductError("");
    setProductDraft({ ...EMPTY_PRODUCT });
  }

  async function saveProduct() {
    const name = productDraft.name.trim();
    const price = Number.parseInt(productDraft.price, 10);
    const stock = Number.parseInt(productDraft.stock, 10);
    if (!name) {
      setProductError("상품명을 입력해 주세요.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setProductError("가격을 0원 이상 숫자로 입력해 주세요.");
      return;
    }
    if (!Number.isFinite(stock) || stock < 0) {
      setProductError("재고 수량을 0 이상 숫자로 입력해 주세요.");
      return;
    }

    setProductSaving(true);
    setProductError("");
    try {
      const payload = {
        name,
        category: productDraft.category,
        description: productDraft.description.trim(),
        price,
        unit: productDraft.unit.trim() || "1개",
        stock,
        status: productDraft.status,
        imageUrl: productDraft.imageUrl.trim(),
      };
      const saved = productEditing
        ? await updateItemProduct(productEditing, payload)
        : await createItemProduct(payload);
      replaceProduct(saved);
      closeProductForm();
      setToast(productEditing ? "상품 정보를 저장했어요." : `'${saved.name}' 상품을 등록했어요.`);
    } catch (err) {
      setProductError(err instanceof Error ? err.message : "상품을 저장하지 못했어요.");
    } finally {
      setProductSaving(false);
    }
  }

  async function patchProduct(
    product: ItemProduct,
    patch: Parameters<typeof updateItemProduct>[1],
    message: string
  ) {
    setBusyId(product.id);
    try {
      replaceProduct(await updateItemProduct(product.id, patch));
      setToast(message);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "변경에 실패했어요.");
    } finally {
      setBusyId(null);
    }
  }

  async function applyStockDraft(product: ItemProduct) {
    const raw = stockDrafts[product.id];
    if (raw === undefined) return;
    const next = Number.parseInt(raw, 10);
    if (!Number.isFinite(next) || next < 0) {
      setToast("재고 수량을 0 이상 숫자로 입력해 주세요.");
      return;
    }
    setStockDrafts((prev) => {
      const copy = { ...prev };
      delete copy[product.id];
      return copy;
    });
    await patchProduct(product, { stock: next }, `재고를 ${next}개로 바꿨어요.`);
  }

  async function deleteProduct(product: ItemProduct) {
    setBusyId(product.id);
    try {
      await removeItemProduct(product.id);
      setData((prev) =>
        prev ? { ...prev, itemProducts: prev.itemProducts.filter((item) => item.id !== product.id) } : prev
      );
      setConfirmProductDelete(null);
      setToast("상품을 삭제했어요.");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "삭제에 실패했어요.");
    } finally {
      setBusyId(null);
    }
  }

  /* ---------------- Item 수요조사·문의 처리 ---------------- */

  async function setWaitlistStatus(entry: ItemWaitlistEntry, status: ItemWaitlistStatus) {
    setBusyId(entry.id);
    try {
      const updated = await updateItemWaitlistEntry(entry.id, { status });
      setData((prev) =>
        prev
          ? {
              ...prev,
              itemWaitlist: prev.itemWaitlist.map((item) =>
                item.id === entry.id ? { ...item, status: updated.status, adminMemo: updated.adminMemo } : item
              ),
            }
          : prev
      );
      setToast(
        status === "done" ? "처리완료로 바꿨어요." : status === "contacted" ? "연락완료로 바꿨어요." : "접수 상태로 되돌렸어요."
      );
    } catch (err) {
      setToast(err instanceof Error ? err.message : "상태를 바꾸지 못했어요.");
    } finally {
      setBusyId(null);
    }
  }

  async function saveWaitlistMemo(entry: ItemWaitlistEntry) {
    const memo = memoDrafts[entry.id];
    if (memo === undefined) return;
    setBusyId(entry.id);
    try {
      const updated = await updateItemWaitlistEntry(entry.id, { adminMemo: memo });
      setData((prev) =>
        prev
          ? {
              ...prev,
              itemWaitlist: prev.itemWaitlist.map((item) =>
                item.id === entry.id ? { ...item, status: updated.status, adminMemo: updated.adminMemo } : item
              ),
            }
          : prev
      );
      setMemoDrafts((prev) => {
        const copy = { ...prev };
        delete copy[entry.id];
        return copy;
      });
      setToast("관리자 메모를 저장했어요.");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "메모를 저장하지 못했어요.");
    } finally {
      setBusyId(null);
    }
  }

  async function copyContact(entry: ItemWaitlistEntry) {
    try {
      await navigator.clipboard.writeText(entry.contact);
      setToast("연락처를 복사했어요.");
    } catch {
      setToast(prettyContact(entry));
    }
  }

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
      revalidateHomeCache();
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
      revalidateHomeCache();
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
      const updated = await updateBookingStatus(
        booking.id,
        status,
        status === "cancelled" ? "host" : null
      );
      if (updated) {
        setData((prev) =>
          prev
            ? { ...prev, bookings: prev.bookings.map((item) => (item.id === updated.id ? updated : item)) }
            : prev
        );
      }
      setToast(
        status === "confirmed"
          ? "입금을 확인해 예약을 확정했어요."
          : status === "cancelled"
            ? "예약을 취소했어요."
            : "예약을 대기 상태로 되돌렸어요."
      );
    } catch (err) {
      setToast(err instanceof Error ? err.message : "예약 상태를 바꾸지 못했어요.");
    } finally {
      setBusyId(null);
    }
  }

  async function reviewSpace(space: Space, status: ApprovalStatus, reason = "") {
    setBusyId(space.id);
    try {
      const updated = await setSpaceApproval(space.id, status, reason);
      if (updated) {
        setData((prev) =>
          prev ? { ...prev, spaces: prev.spaces.map((item) => (item.id === updated.id ? updated : item)) } : prev
        );
      }
      setRejectTarget(null);
      setRejectReason("");
      revalidateHomeCache();
      setToast(
        status === "approved" ? "공간을 승인했어요. 손님 화면에 공개됩니다." : status === "rejected" ? "공간을 반려했어요." : "승인 대기로 되돌렸어요."
      );
    } catch (err) {
      setToast(err instanceof Error ? err.message : "승인 상태를 바꾸지 못했어요.");
    } finally {
      setBusyId(null);
    }
  }

  async function changeRefund(booking: Booking, refundStatus: "pending" | "completed") {
    setBusyId(booking.id);
    try {
      const updated = await updateRefundStatus(booking.id, refundStatus, refundStatus === "completed" ? "관리자 환불 처리" : "");
      if (updated) {
        setData((prev) =>
          prev ? { ...prev, bookings: prev.bookings.map((item) => (item.id === updated.id ? updated : item)) } : prev
        );
      }
      setToast(refundStatus === "completed" ? "환불 완료로 처리했어요." : "환불 필요로 표시했어요.");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "환불 상태를 바꾸지 못했어요.");
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
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-light text-brand-dark">
            <ShieldIcon size={26} />
          </span>
          <h1 className="mt-4 text-xl font-extrabold text-ink">총괄 관리자 전용 페이지</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-mute">
            전체 공간·예약·회원을 관리하려면 관리자 계정으로 로그인해 주세요.
          </p>
          <Link href="/auth?next=/admin" className="btn-primary mt-5 w-full py-3">
            관리자로 로그인
          </Link>
          <Link href="/" className="mt-2 block text-xs font-semibold text-ink-mute hover:text-brand-dark">
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
          <h1 className="mt-4 text-xl font-extrabold text-ink">접근 권한이 없어요</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-mute">
            <b className="text-ink-soft">{user.email}</b> 계정은 총괄 관리자 권한이 없어요.
            <br />
            관리자 계정으로 다시 로그인해 주세요.
          </p>
          <Link href="/auth?next=/admin" className="btn-primary mt-5 w-full py-3">
            다른 계정으로 로그인
          </Link>
          <Link href="/" className="mt-2 block text-xs font-semibold text-ink-mute hover:text-brand-dark">
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
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-bold tracking-wide">
              <ShieldIcon size={12} /> 이곳저곳 ADMIN
            </p>
            <h1 className="mt-2.5 text-2xl font-extrabold tracking-tight sm:text-3xl">이곳저곳 총괄 관리자</h1>
            <p className="mt-1 text-xs text-white/75">
              {user.name} 님 · 전체 공간 {stats.spaces}개 · 예약 {stats.bookings}건 · 회원 {stats.profiles}명 · Item 상품{" "}
              {stats.itemProducts}개 · 문의 {stats.itemWaitlist}건을 관리합니다.
            </p>
            {mode === "demo" && (
              <p className="mt-2 rounded-lg bg-white/10 px-2.5 py-1.5 text-[12px] text-white/80">
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
              className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-brand-dark transition hover:bg-brand-light"
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
          hint={`공개 ${stats.visible} · 비공개 ${stats.hidden} · 승인 대기 ${stats.pendingApproval}`}
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
            item.key === "spaces"
              ? stats.spaces
              : item.key === "bookings"
                ? stats.bookings
                : item.key === "item"
                  ? stats.itemWaitlist
                  : stats.profiles;
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
                  "rounded-full px-1.5 py-0.5 text-[12px] font-bold",
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
                입점 공간 <span className="text-brand-dark">{filteredSpaces.length}</span>
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
            <div className="flex flex-wrap gap-1.5">
              {([
                { key: "all" as const, label: "승인 전체" },
                { key: "pending_review" as const, label: `승인 대기 ${stats.pendingApproval}` },
                { key: "approved" as const, label: "공개 중" },
                { key: "rejected" as const, label: "반려" },
              ]).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setApprovalFilter(item.key)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[12px] font-bold transition",
                    approvalFilter === item.key
                      ? "border-brand bg-brand text-white"
                      : "border-ink-line bg-white text-ink-soft hover:border-brand/40 hover:text-brand-dark"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <CategoryChips active={category} onSelect={setCategory} size="sm" className="pb-0.5" />
          </div>

          {filteredSpaces.length === 0 ? (
            <div className="card mt-4 flex flex-col items-center gap-2 px-6 py-14 text-center">
              <StoreIcon size={30} className="text-brand-dark/60" />
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
                        <span className={cn("badge", APPROVAL_STYLE[space.approvalStatus])}>
                          {APPROVAL_LABEL[space.approvalStatus]}
                        </span>
                        <span className={cn("badge", space.hidden ? "bg-slate-700 text-white" : "bg-emerald-50 text-emerald-600")}>
                          {space.hidden ? "비공개" : "공개"}
                        </span>
                        {space.featured && <span className="badge bg-ink text-white">AD 노출</span>}
                        {space.timeDeal && space.discountRate > 0 && (
                          <span className="badge bg-brand-light text-brand-dark">타임특가 {space.discountRate}%</span>
                        )}
                        <span className="text-[12px] font-semibold text-ink-mute">
                          No. {shortId(space.id)}
                        </span>
                      </div>
                      <h3 className="mt-1 truncate text-sm font-extrabold text-ink">{space.name}</h3>
                      <p className="mt-0.5 truncate text-[12px] text-ink-soft">
                        {CATEGORY_MAP[space.category]?.label ?? space.category} · {space.region} {space.district} ·{" "}
                        {won(space.pricePerHour)}/시간 · {space.capacity}명
                      </p>
                      <p className="mt-0.5 truncate text-[12px] text-ink-mute">
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

                  {space.approvalStatus === "rejected" && space.rejectionReason && (
                    <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-[12px] font-semibold text-red-600">
                      반려 사유 · {space.rejectionReason}
                    </p>
                  )}

                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-ink-line/20 px-2.5 py-2">
                    <p className="text-[12px] font-bold text-ink-soft">
                      {space.approvalStatus === "approved"
                        ? "손님 화면에 공개 중이에요."
                        : space.approvalStatus === "rejected"
                          ? "반려된 상태 — 사장님이 수정 후 재요청할 수 있어요."
                          : "승인 대기 — 공개·결제가 잠겨 있어요."}
                    </p>
                    <div className="flex gap-1.5">
                      {space.approvalStatus !== "approved" && (
                        <button
                          type="button"
                          disabled={busyId === space.id}
                          onClick={() => void reviewSpace(space, "approved")}
                          className="rounded-lg bg-brand px-3 py-1.5 text-[12px] font-bold text-white hover:bg-brand-dark disabled:opacity-60"
                        >
                          승인
                        </button>
                      )}
                      {space.approvalStatus !== "rejected" && (
                        <button
                          type="button"
                          disabled={busyId === space.id}
                          onClick={() => {
                            setRejectTarget(space.id);
                            setRejectReason("");
                          }}
                          className="rounded-lg border border-ink-line bg-white px-3 py-1.5 text-[12px] font-bold text-ink-soft hover:border-red-200 hover:text-red-500 disabled:opacity-60"
                        >
                          반려
                        </button>
                      )}
                    </div>
                  </div>

                  {rejectTarget === space.id && (
                    <div className="mt-2 rounded-lg bg-red-50 p-2.5">
                      <p className="text-[12px] font-semibold text-red-700">반려 사유를 적어 주세요. 사장님 센터에 그대로 보여요.</p>
                      <input
                        value={rejectReason}
                        onChange={(event) => setRejectReason(event.target.value)}
                        placeholder="예: 상세주소가 확인되지 않아요. 정확한 주소를 입력해 주세요."
                        className="input mt-1.5 text-[12px]"
                      />
                      <div className="mt-1.5 flex gap-1.5">
                        <button
                          type="button"
                          disabled={busyId === space.id || !rejectReason.trim()}
                          onClick={() => void reviewSpace(space, "rejected", rejectReason.trim())}
                          className="rounded-md bg-red-500 px-2.5 py-1 text-[12px] font-bold text-white disabled:opacity-60"
                        >
                          반려 확정
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectTarget(null)}
                          className="rounded-md bg-white px-2.5 py-1 text-[12px] font-bold text-ink-soft"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  )}

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
                      <p className="text-[12px] font-semibold text-red-700">
                        <b>{space.name}</b> 을(를) 삭제할까요? 연결된 예약 {bookingCountBySpace.get(space.id) ?? 0}건도 함께
                        삭제되며 되돌릴 수 없어요.
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          disabled={busyId === space.id}
                          onClick={() => void deleteSpace(space)}
                          className="rounded-lg bg-red-500 px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-60"
                        >
                          {busyId === space.id ? "삭제 중…" : "삭제"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(null)}
                          className="rounded-lg bg-white px-3 py-1.5 text-[12px] font-bold text-ink-soft"
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
              예약 현황 <span className="text-brand-dark">{filteredBookings.length}</span>
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
                  "rounded-full border px-3 py-1.5 text-[12px] font-bold transition",
                  statusFilter === item.key
                    ? "border-brand bg-brand text-white"
                    : "border-ink-line bg-white text-ink-soft hover:border-brand/40 hover:text-brand-dark"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {filteredBookings.length === 0 ? (
            <div className="card mt-4 flex flex-col items-center gap-2 px-6 py-14 text-center">
              <CalendarIcon size={30} className="text-brand-dark/60" />
              <p className="text-sm font-bold text-ink">조건에 맞는 예약이 없어요</p>
              <p className="text-xs text-ink-mute">상태 필터나 검색어를 바꿔 보세요.</p>
            </div>
          ) : (
            <>
              <div className="card mt-4 hidden overflow-x-auto md:block">
                <table className="w-full min-w-[860px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-ink-line bg-ink-line/25 text-[12px] text-ink-mute">
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
                        <td className="px-3 py-2.5 font-mono text-[12px] text-ink-mute">{shortId(booking.id)}</td>
                        <td className="max-w-[180px] px-3 py-2.5">
                          <span className="block truncate font-bold text-ink">{booking.spaceName}</span>
                          <span className="text-[12px] text-ink-mute">
                            {booking.source === "block" ? "시간 차단" : booking.channel === "link" ? "결제 링크" : "웹"} ·{" "}
                            {formatRelativeDate(booking.createdAt)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="block font-semibold text-ink">{booking.guestName}</span>
                          <span className="text-[12px] text-ink-mute">{booking.guestPhone}</span>
                        </td>
                        <td className="px-3 py-2.5 text-ink-soft">
                          {formatDate(booking.date)}
                          <span className="block text-[12px] text-ink-mute">
                            {formatTime(booking.startTime)} ~ {endTime(booking.startTime, booking.hours)} · {booking.hours}시간
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-ink-soft">{booking.guests}명</td>
                        <td className="px-3 py-2.5 text-right font-extrabold text-ink">{won(booking.totalAmount)}</td>
                        <td className="px-3 py-2.5">
                          <span className={cn("badge", bookingStatusMeta(booking).style)}>
                            {bookingStatusMeta(booking).label}
                          </span>
                          {booking.source === "block" && (
                            <span className="ml-1 badge bg-slate-100 text-slate-500">시간 차단</span>
                          )}
                          {booking.status === "cancelled" && booking.refundStatus !== "none" && (
                            <span className={cn("badge ml-1", REFUND_STYLE[booking.refundStatus])}>
                              {REFUND_LABEL[booking.refundStatus]}
                            </span>
                          )}
                          {booking.status === "pending" && (
                            <DepositInfoRow booking={booking} className="mt-1.5 w-[210px]" />
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex justify-end gap-1">
                            {booking.status !== "confirmed" && (
                              <button
                                type="button"
                                disabled={busyId === booking.id}
                                onClick={() => void changeBookingStatus(booking, "confirmed")}
                                className="inline-flex items-center gap-0.5 rounded-md bg-emerald-50 px-2 py-1 text-[12px] font-bold text-emerald-600 hover:bg-emerald-100 disabled:opacity-50"
                              >
                                <CheckIcon size={11} />
                                {booking.status === "pending" ? "입금 확인" : "확정"}
                              </button>
                            )}
                            {booking.status !== "cancelled" ? (
                              <button
                                type="button"
                                disabled={busyId === booking.id}
                                onClick={() => void changeBookingStatus(booking, "cancelled")}
                                className="inline-flex items-center gap-0.5 rounded-md bg-red-50 px-2 py-1 text-[12px] font-bold text-red-500 hover:bg-red-100 disabled:opacity-50"
                              >
                                <CloseIcon size={11} />
                                {booking.status === "pending" ? "거절" : "취소"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={busyId === booking.id}
                                onClick={() => void changeBookingStatus(booking, "pending")}
                                className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 px-2 py-1 text-[12px] font-bold text-slate-500 hover:bg-slate-200 disabled:opacity-50"
                              >
                                <BoltIcon size={11} /> 대기
                              </button>
                            )}
                            {booking.status === "cancelled" && booking.refundStatus === "pending" && (
                              <button
                                type="button"
                                disabled={busyId === booking.id}
                                onClick={() => void changeRefund(booking, "completed")}
                                className="inline-flex items-center gap-0.5 rounded-md bg-amber-50 px-2 py-1 text-[12px] font-bold text-amber-600 hover:bg-amber-100 disabled:opacity-50"
                              >
                                <CheckIcon size={11} /> 환불 완료
                              </button>
                            )}
                          </div>
                          <BookingTimeline
                            events={bookingEvents.filter((event) => event.bookingId === booking.id)}
                          />
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
                      <span className={cn("badge", bookingStatusMeta(booking).style)}>
                        {bookingStatusMeta(booking).label}
                      </span>
                      <span className="font-mono text-[12px] text-ink-mute">No. {shortId(booking.id)}</span>
                      <span className="text-[12px] text-ink-mute">
                        · {booking.source === "block" ? "시간 차단" : booking.channel === "link" ? "결제 링크" : "웹"} ·{" "}
                            {formatRelativeDate(booking.createdAt)}
                      </span>
                    </div>
                    <h3 className="mt-1.5 truncate text-sm font-extrabold text-ink">{booking.spaceName}</h3>
                    <p className="mt-0.5 text-[12px] text-ink-soft">
                      {booking.guestName} · {booking.guestPhone}
                    </p>
                    <p className="mt-0.5 text-[12px] text-ink-mute">
                      {formatDate(booking.date)} {formatTime(booking.startTime)} ~{" "}
                      {endTime(booking.startTime, booking.hours)} · {booking.hours}시간 · {booking.guests}명
                    </p>
                    {booking.status === "pending" && <DepositInfoRow booking={booking} className="mt-1.5" />}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-extrabold text-ink">{won(booking.totalAmount)}</span>
                      <div className="flex gap-1.5">
                        {booking.status !== "confirmed" && (
                          <button
                            type="button"
                            disabled={busyId === booking.id}
                            onClick={() => void changeBookingStatus(booking, "confirmed")}
                            className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[12px] font-bold text-emerald-600 disabled:opacity-50"
                          >
                            {booking.status === "pending" ? "입금 확인" : "확정"}
                          </button>
                        )}
                        {booking.status === "cancelled" && booking.refundStatus === "pending" && (
                          <button
                            type="button"
                            disabled={busyId === booking.id}
                            onClick={() => void changeRefund(booking, "completed")}
                            className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[12px] font-bold text-amber-600 disabled:opacity-50"
                          >
                            환불 완료
                          </button>
                        )}
                        {booking.status !== "cancelled" ? (
                          <button
                            type="button"
                            disabled={busyId === booking.id}
                            onClick={() => void changeBookingStatus(booking, "cancelled")}
                            className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[12px] font-bold text-red-500 disabled:opacity-50"
                          >
                            {booking.status === "pending" ? "거절" : "취소"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId === booking.id}
                            onClick={() => void changeBookingStatus(booking, "pending")}
                            className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[12px] font-bold text-slate-500 disabled:opacity-50"
                          >
                            대기로
                          </button>
                        )}
                      </div>
                    </div>
                    <BookingTimeline
                      events={bookingEvents.filter((event) => event.bookingId === booking.id)}
                    />
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
              입점 사장님·회원 <span className="text-brand-dark">{filteredProfiles.length}</span>
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
              <UsersIcon size={30} className="text-brand-dark/60" />
              <p className="text-sm font-bold text-ink">조건에 맞는 회원이 없어요</p>
              <p className="text-xs text-ink-mute">검색어를 바꿔 보세요.</p>
            </div>
          ) : (
            <>
              <div className="card mt-4 hidden overflow-x-auto md:block">
                <table className="w-full min-w-[720px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-ink-line bg-ink-line/25 text-[12px] text-ink-mute">
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
                              <span className="badge bg-brand-light text-brand-dark">ADMIN</span>
                            )}
                            {profile.email}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={cn(
                              "badge",
                              profile.role === "host" ? "bg-brand-light text-brand-dark" : "bg-slate-100 text-slate-500"
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
                              profile.role === "host" ? "bg-brand-light text-brand-dark" : "bg-slate-100 text-slate-500"
                            )}
                          >
                            {profile.role === "host" ? "사장님" : "게스트"}
                          </span>
                        </p>
                        <p className="mt-0.5 truncate text-[12px] text-ink-soft">{profile.email}</p>
                      </div>
                      {isAdminEmail(profile.email) && (
                        <span className="badge shrink-0 bg-brand text-white">ADMIN</span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink-mute">
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

      {!loading && data && tab === "item" && (
        <section className="mt-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="등록 상품"
              value={`${stats.itemProducts}개`}
              hint={`판매중 ${stats.itemActive} · 숨김 ${stats.itemHidden}`}
              tone="brand"
            />
            <StatCard
              label="품절·재고부족"
              value={`${stats.itemStockLow}개`}
              hint={`재고 ${ITEM_LOW_STOCK}개 이하 포함`}
            />
            <StatCard
              label="미처리 문의"
              value={`${stats.itemPending}건`}
              hint={`연락완료 ${waitlistStatusCounts.contacted} · 전체 ${stats.itemWaitlist}건`}
            />
            <StatCard label="오픈 알림 신청" value={`${itemNoticeCount}건`} hint="수요조사 중 알림 동의" />
          </div>

          {stats.itemWaitlist > 0 && (
            <div className="mt-4">
              <p className="text-[12px] font-bold text-ink-soft">카테고리별 수요 — 어떤 품목부터 입고할지 판단해요</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {itemDemand.map((item) => (
                  <div key={item.key} className="card px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-[12px] font-bold text-ink-soft">
                      <span aria-hidden>{item.emoji}</span>
                      <span className="truncate">{item.label}</span>
                    </p>
                    <p className="mt-1 text-lg font-extrabold tabular-nums text-ink">
                      {item.count}
                      <span className="ml-0.5 text-[12px] font-semibold text-ink-mute">건</span>
                    </p>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-line/70">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${Math.round((item.count / Math.max(1, stats.itemWaitlist)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl bg-ink-line/40 p-1">
              {([
                { key: "products" as const, label: "상품·재고 관리", count: stats.itemProducts },
                { key: "waitlist" as const, label: "수요조사·문의", count: stats.itemWaitlist },
              ]).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setItemView(item.key)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2.5 text-[13px] font-bold transition",
                    itemView === item.key ? "bg-white text-ink shadow-sm" : "text-ink-mute hover:text-ink"
                  )}
                >
                  {item.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[12px] font-bold",
                      itemView === item.key ? "bg-brand text-white" : "bg-white text-ink-mute"
                    )}
                  >
                    {item.count}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <Link href="/item" className="btn-ghost btn-sm">
                /item 페이지 보기
              </Link>
              <button type="button" onClick={() => void load()} className="btn-ghost btn-sm">
                새로고침
              </button>
            </div>
          </div>

          {itemView === "products" && (
            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-extrabold text-ink">
                  상품·재고 <span className="text-brand-dark">{stats.itemProducts}</span>
                  <span className="ml-1 text-xs font-semibold text-ink-mute">/ 숨김 상품 포함</span>
                </h3>
                <button
                  type="button"
                  onClick={() => (productFormOpen ? closeProductForm() : openProductForm())}
                  className="inline-flex h-11 items-center gap-1 rounded-xl bg-brand px-4 text-[13px] font-bold text-white transition hover:bg-brand-dark"
                >
                  <PlusIcon size={15} />
                  {productFormOpen ? "등록 닫기" : "새 상품 등록"}
                </button>
              </div>

              {productFormOpen && (
                <div className="card mt-3 border-brand/30 p-4">
                  <p className="text-sm font-extrabold text-ink">{productEditing ? "상품 수정" : "새 상품 등록"}</p>
                  <p className="mt-0.5 text-[12px] text-ink-mute">
                    재고 0으로 등록하면 품절로 시작해요. 숨김 상품은 /item 페이지에 보이지 않습니다.
                  </p>
                  <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                    <label className="block text-[12px] font-bold text-ink-soft">
                      상품명 <span className="text-brand">*</span>
                      <input
                        value={productDraft.name}
                        onChange={(event) => setProductDraft((prev) => ({ ...prev, name: event.target.value }))}
                        placeholder="예: 엡손 EB-970 빔프로젝터"
                        maxLength={80}
                        className="input mt-1 text-[13px]"
                      />
                    </label>
                    <label className="block text-[12px] font-bold text-ink-soft">
                      카테고리
                      <select
                        value={productDraft.category}
                        onChange={(event) => setProductDraft((prev) => ({ ...prev, category: event.target.value }))}
                        className="input mt-1 text-[13px] font-semibold"
                      >
                        {ITEM_CATEGORIES.map((item) => (
                          <option key={item.key} value={item.key}>
                            {item.emoji} {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-[12px] font-bold text-ink-soft">
                      가격(원) <span className="text-brand">*</span>
                      <input
                        value={productDraft.price}
                        onChange={(event) => setProductDraft((prev) => ({ ...prev, price: event.target.value.replace(/[^\d]/g, "") }))}
                        inputMode="numeric"
                        placeholder="예: 350000"
                        className="input mt-1 text-[13px]"
                      />
                    </label>
                    <label className="block text-[12px] font-bold text-ink-soft">
                      판매 단위
                      <input
                        value={productDraft.unit}
                        onChange={(event) => setProductDraft((prev) => ({ ...prev, unit: event.target.value }))}
                        placeholder="예: 1세트(10개)"
                        maxLength={40}
                        className="input mt-1 text-[13px]"
                      />
                    </label>
                    <label className="block text-[12px] font-bold text-ink-soft">
                      재고 수량 <span className="text-brand">*</span>
                      <input
                        value={productDraft.stock}
                        onChange={(event) => setProductDraft((prev) => ({ ...prev, stock: event.target.value.replace(/[^\d]/g, "") }))}
                        inputMode="numeric"
                        placeholder="0"
                        className="input mt-1 text-[13px]"
                      />
                    </label>
                    <label className="block text-[12px] font-bold text-ink-soft">
                      판매 상태
                      <select
                        value={productDraft.status}
                        onChange={(event) =>
                          setProductDraft((prev) => ({ ...prev, status: event.target.value as ItemProductStatus }))
                        }
                        className="input mt-1 text-[13px] font-semibold"
                      >
                        {ITEM_PRODUCT_STATUSES.map((item) => (
                          <option key={item.key} value={item.key}>
                            {item.label} — {item.hint}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-[12px] font-bold text-ink-soft sm:col-span-2">
                      간단한 설명
                      <textarea
                        value={productDraft.description}
                        onChange={(event) => setProductDraft((prev) => ({ ...prev, description: event.target.value }))}
                        rows={2}
                        maxLength={500}
                        placeholder="예: 램프 2,300시간 · HDMI 2포트 · 리모컨 포함"
                        className="input mt-1 resize-y text-[13px]"
                      />
                    </label>
                    <label className="block text-[12px] font-bold text-ink-soft sm:col-span-2">
                      이미지 URL
                      <input
                        value={productDraft.imageUrl}
                        onChange={(event) => setProductDraft((prev) => ({ ...prev, imageUrl: event.target.value }))}
                        placeholder="https://... 또는 /images/..."
                        maxLength={500}
                        className="input mt-1 text-[13px]"
                      />
                    </label>
                  </div>

                  {productError && (
                    <p className="mt-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-600">
                      {productError}
                    </p>
                  )}

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={productSaving}
                      onClick={() => void saveProduct()}
                      className="h-11 flex-1 rounded-xl bg-brand text-[13px] font-bold text-white transition hover:bg-brand-dark disabled:opacity-60"
                    >
                      {productSaving ? "저장 중…" : productEditing ? "수정 저장" : "상품 등록"}
                    </button>
                    <button
                      type="button"
                      onClick={closeProductForm}
                      className="h-11 rounded-xl border border-ink-line bg-white px-4 text-[13px] font-bold text-ink-soft hover:bg-ink-line/30"
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}

              {data.itemProducts.length === 0 ? (
                <div className="card mt-3 flex flex-col items-center gap-2 px-6 py-14 text-center">
                  <SparkleIcon size={30} className="text-brand-dark/60" />
                  <p className="text-sm font-bold text-ink">아직 등록한 상품이 없어요</p>
                  <p className="text-xs text-ink-mute">위의 [새 상품 등록]으로 첫 상품을 올리면 /item 페이지에 바로 보여요.</p>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  {data.itemProducts.map((product) => {
                    const statusMeta = ITEM_PRODUCT_STATUS_MAP[product.status];
                    const cat = ITEM_CATEGORY_MAP[product.category];
                    const lowStock = product.status !== "hidden" && product.stock <= ITEM_LOW_STOCK;
                    const stockDirty = stockDrafts[product.id] !== undefined;
                    return (
                      <article key={product.id} className="card p-3.5">
                        <div className="flex gap-3">
                          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-ink-line bg-ink-line/20">
                            {product.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={product.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                            ) : (
                              <span className="text-2xl" aria-hidden>
                                {cat?.emoji ?? "📦"}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1">
                              <span className={cn("badge", statusMeta?.style)}>{statusMeta?.label}</span>
                              <span className="badge bg-ink-line/60 text-ink-soft">{itemCategoryLabel(product.category)}</span>
                              {lowStock && <span className="badge bg-brand-light text-brand-dark">재고부족</span>}
                            </div>
                            <h4 className="mt-1 truncate text-sm font-extrabold text-ink">{product.name}</h4>
                            <p className="mt-0.5 text-[12px] text-ink-soft">
                              {won(product.price)} / {product.unit} · 재고 {product.stock}개
                            </p>
                            {product.description && (
                              <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-ink-mute">
                                {product.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                          <div>
                            <p className="text-[12px] font-bold text-ink-soft">재고 수량</p>
                            <div className="mt-1 flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={busyId === product.id || product.stock <= 0}
                                onClick={() => void patchProduct(product, { stockDelta: -1 }, "재고를 1개 줄였어요.")}
                                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-ink-line bg-white text-lg font-bold text-ink-soft transition hover:border-brand/40 hover:text-brand-dark disabled:opacity-40"
                                aria-label={`${product.name} 재고 1개 줄이기`}
                              >
                                −
                              </button>
                              <input
                                value={stockDrafts[product.id] ?? String(product.stock)}
                                onChange={(event) =>
                                  setStockDrafts((prev) => ({
                                    ...prev,
                                    [product.id]: event.target.value.replace(/[^\d]/g, ""),
                                  }))
                                }
                                inputMode="numeric"
                                aria-label={`${product.name} 재고 수량`}
                                className="input h-11 w-16 text-center text-[13px] font-bold tabular-nums"
                              />
                              <button
                                type="button"
                                disabled={busyId === product.id}
                                onClick={() => void patchProduct(product, { stockDelta: 1 }, "재고를 1개 늘렸어요.")}
                                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-ink-line bg-white text-lg font-bold text-ink-soft transition hover:border-brand/40 hover:text-brand-dark disabled:opacity-40"
                                aria-label={`${product.name} 재고 1개 늘리기`}
                              >
                                +
                              </button>
                              {stockDirty && (
                                <button
                                  type="button"
                                  disabled={busyId === product.id}
                                  onClick={() => void applyStockDraft(product)}
                                  className="h-11 rounded-lg bg-ink px-3 text-[12px] font-bold text-white disabled:opacity-50"
                                >
                                  적용
                                </button>
                              )}
                            </div>
                          </div>
                          <label className="block text-[12px] font-bold text-ink-soft">
                            판매 상태
                            <select
                              value={product.status}
                              disabled={busyId === product.id}
                              onChange={(event) =>
                                void patchProduct(
                                  product,
                                  { status: event.target.value as ItemProductStatus },
                                  "판매 상태를 바꿨어요."
                                )
                              }
                              className="input mt-1 h-11 text-[13px] font-semibold"
                              aria-label={`${product.name} 판매 상태`}
                            >
                              {ITEM_PRODUCT_STATUSES.map((item) => (
                                <option key={item.key} value={item.key}>
                                  {item.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[12px] text-ink-mute">
                            {product.status === "hidden"
                              ? "/item 페이지에서 숨김"
                              : product.status === "soldout"
                                ? "품절 — 목록에는 보이지만 재고 없음"
                                : product.status === "restocking"
                                  ? "입고대기 — 문의를 받는 중"
                                  : "/item 페이지에 공개 중"}
                          </p>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => openProductForm(product)}
                              className="h-11 rounded-lg border border-ink-line bg-white px-3 text-[12px] font-bold text-ink-soft transition hover:border-brand/40 hover:text-brand-dark"
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmProductDelete(product.id)}
                              className="inline-flex h-11 items-center gap-1 rounded-lg border border-ink-line bg-white px-3 text-[12px] font-bold text-ink-mute transition hover:border-red-200 hover:text-red-500"
                            >
                              <TrashIcon size={13} /> 삭제
                            </button>
                          </div>
                        </div>

                        {confirmProductDelete === product.id && (
                          <div className="mt-2 rounded-lg bg-red-50 p-3">
                            <p className="text-[12px] font-semibold text-red-700">
                              <b>{product.name}</b> 을(를) 삭제할까요? /item 페이지에서도 사라지며 되돌릴 수 없어요.
                            </p>
                            <div className="mt-2 flex gap-2">
                              <button
                                type="button"
                                disabled={busyId === product.id}
                                onClick={() => void deleteProduct(product)}
                                className="h-11 rounded-lg bg-red-500 px-3 text-[12px] font-bold text-white disabled:opacity-60"
                              >
                                {busyId === product.id ? "삭제 중…" : "삭제"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmProductDelete(null)}
                                className="h-11 rounded-lg bg-white px-3 text-[12px] font-bold text-ink-soft"
                              >
                                취소
                              </button>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {itemView === "waitlist" && (
            <div className="mt-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-ink">
                    이곳저곳 Item 수요조사·문의{" "}
                    <span className="text-brand-dark">{filteredWaitlist.length}</span>
                    <span className="ml-1 text-xs font-semibold text-ink-mute">/ 전체 {stats.itemWaitlist}건</span>
                  </h3>
                  <p className="mt-0.5 text-xs text-ink-mute">
                    오픈 알림 신청 {itemNoticeCount}건 · 공개 페이지{" "}
                    <Link href="/item" className="font-semibold text-brand-dark underline">
                      /item
                    </Link>
                  </p>
                </div>
                <div className="relative w-full sm:max-w-xs">
                  <SearchIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
                  <input
                    value={itemQuery}
                    onChange={(event) => setItemQuery(event.target.value)}
                    placeholder="연락처·품목·메모 검색"
                    className="input py-2 pl-9 text-xs"
                    aria-label="수요조사 검색"
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {([
                  { key: "all" as const, label: "전체", count: waitlistStatusCounts.all },
                  { key: "new" as const, label: "접수", count: waitlistStatusCounts.new },
                  { key: "contacted" as const, label: "연락완료", count: waitlistStatusCounts.contacted },
                  { key: "done" as const, label: "처리완료", count: waitlistStatusCounts.done },
                ]).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setWaitlistFilter(item.key)}
                    className={cn(
                      "rounded-full border px-3 py-2 text-[12px] font-bold transition",
                      waitlistFilter === item.key
                        ? "border-brand bg-brand text-white"
                        : "border-ink-line bg-white text-ink-soft hover:border-brand/40 hover:text-brand-dark"
                    )}
                  >
                    {item.label} {item.count}
                  </button>
                ))}
              </div>

              {filteredWaitlist.length === 0 ? (
                <div className="card mt-3 flex flex-col items-center gap-2 px-6 py-14 text-center">
                  <SparkleIcon size={30} className="text-brand-dark/60" />
                  <p className="text-sm font-bold text-ink">
                    {stats.itemWaitlist === 0 ? "아직 접수된 수요조사가 없어요" : "조건에 맞는 신청이 없어요"}
                  </p>
                  <p className="text-xs text-ink-mute">
                    {stats.itemWaitlist === 0 ? (
                      <>
                        <Link href="/item" className="font-semibold text-brand-dark underline">
                          /item
                        </Link>{" "}
                        페이지에서 신청이 들어오면 여기에 쌓입니다.
                      </>
                    ) : (
                      "상태 필터나 검색어를 바꿔 보세요."
                    )}
                  </p>
                </div>
              ) : (
                <div className="mt-3 space-y-2.5">
                  {filteredWaitlist.map((entry) => {
                    const statusMeta = ITEM_WAITLIST_STATUSES.find((item) => item.key === entry.status);
                    const memoValue = memoDrafts[entry.id] ?? entry.adminMemo;
                    const memoDirty = memoDrafts[entry.id] !== undefined && memoDrafts[entry.id] !== entry.adminMemo;
                    return (
                      <article key={entry.id} className="card p-3.5">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-1.5 text-sm font-extrabold text-ink">
                              {prettyContact(entry)}
                              <span className={cn("badge", statusMeta?.style)}>{statusMeta?.label ?? "접수"}</span>
                              <span className="badge bg-brand-light text-brand-dark">
                                {itemSpaceTypeLabel(entry.spaceType)}
                              </span>
                              {entry.wantsNotice && <span className="badge bg-emerald-50 text-emerald-600">알림</span>}
                            </p>
                            <p className="mt-0.5 text-[12px] text-ink-mute">
                              접수 {receivedAt(entry.createdAt)} · {entry.contactType === "email" ? "메일" : "문자"}
                            </p>
                          </div>
                          <label className="block shrink-0 text-[12px] font-bold text-ink-soft sm:w-40">
                            처리 상태
                            <select
                              value={entry.status}
                              disabled={busyId === entry.id}
                              onChange={(event) =>
                                void setWaitlistStatus(entry, event.target.value as ItemWaitlistStatus)
                              }
                              className="input mt-1 h-11 text-[13px] font-semibold"
                              aria-label={`${prettyContact(entry)} 처리 상태`}
                            >
                              {ITEM_WAITLIST_STATUSES.map((item) => (
                                <option key={item.key} value={item.key}>
                                  {item.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        {entry.categories.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {entry.categories.map((key) => (
                              <span key={key} className="badge bg-ink-line/60 text-ink-soft">
                                {itemCategoryLabel(key)}
                              </span>
                            ))}
                          </div>
                        )}
                        {entry.customItem && (
                          <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">
                            <b className="text-ink">희망 품목</b> {entry.customItem}
                          </p>
                        )}
                        {entry.budgetOrQty && (
                          <p className="mt-1 text-[12px] text-ink-soft">
                            <b className="text-ink">예산·수량</b> {entry.budgetOrQty}
                          </p>
                        )}
                        {entry.note && (
                          <p className="mt-1 text-[12px] leading-relaxed text-ink-mute">
                            <b className="text-ink-soft">요청사항</b> {entry.note}
                          </p>
                        )}

                        <div className="mt-2 rounded-xl bg-ink-line/20 p-2.5">
                          <label htmlFor={`item-memo-${entry.id}`} className="block text-[12px] font-bold text-ink-soft">
                            관리자 메모
                          </label>
                          <textarea
                            id={`item-memo-${entry.id}`}
                            value={memoValue}
                            onChange={(event) => setMemoDrafts((prev) => ({ ...prev, [entry.id]: event.target.value }))}
                            rows={2}
                            maxLength={2000}
                            placeholder="예: 11/24 문자 발송 · 2세트 견적 안내"
                            className="input mt-1 resize-y text-[13px]"
                          />
                          <div className="mt-1.5 flex items-center justify-between gap-2">
                            <p className="text-[12px] text-ink-mute">
                              {entry.adminMemo ? "저장된 메모 있음" : "아직 메모 없음"}
                            </p>
                            <button
                              type="button"
                              disabled={busyId === entry.id || !memoDirty}
                              onClick={() => void saveWaitlistMemo(entry)}
                              className="h-11 rounded-lg bg-ink px-3 text-[12px] font-bold text-white disabled:opacity-40"
                            >
                              {busyId === entry.id ? "저장 중…" : "메모 저장"}
                            </button>
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => void copyContact(entry)}
                            className="inline-flex h-11 items-center gap-1 rounded-lg border border-ink-line bg-white px-3 text-[12px] font-bold text-ink-soft transition hover:border-brand/40 hover:text-brand-dark"
                          >
                            <CopyIcon size={13} /> 연락처 복사
                          </button>
                          {entry.contactType === "phone" ? (
                            <a
                              href={`tel:${entry.contact}`}
                              className="inline-flex h-11 items-center rounded-lg border border-ink-line bg-white px-3 text-[12px] font-bold text-ink-soft transition hover:border-brand/40 hover:text-brand-dark"
                            >
                              전화 걸기
                            </a>
                          ) : (
                            <a
                              href={`mailto:${entry.contact}`}
                              className="inline-flex h-11 items-center rounded-lg border border-ink-line bg-white px-3 text-[12px] font-bold text-ink-soft transition hover:border-brand/40 hover:text-brand-dark"
                            >
                              메일 보내기
                            </a>
                          )}
                          {confirmDelete === entry.id ? (
                            <span className="inline-flex gap-1.5">
                              <button
                                type="button"
                                disabled={busyId === entry.id}
                                onClick={() => void deleteWaitlist(entry)}
                                className="h-11 rounded-lg bg-red-500 px-3 text-[12px] font-bold text-white disabled:opacity-60"
                              >
                                삭제
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDelete(null)}
                                className="h-11 rounded-lg bg-ink-line/70 px-3 text-[12px] font-bold text-ink-soft"
                              >
                                취소
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(entry.id)}
                              className="inline-flex h-11 items-center gap-1 rounded-lg border border-ink-line bg-white px-3 text-[12px] font-bold text-ink-mute transition hover:border-red-200 hover:text-red-500"
                            >
                              <TrashIcon size={13} /> 삭제
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
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
