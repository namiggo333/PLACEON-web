"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getBookingToken } from "@/lib/db";
import { ACTOR_LABEL, EVENT_LABEL } from "@/lib/constants";
import { cn, formatDate, formatTime } from "@/lib/format";
import type { Booking, BookingEvent, SpacePrivate } from "@/lib/types";
import { CheckIcon, ClockIcon } from "./Icons";

export interface BookingAccessPayload {
  access: SpacePrivate | null;
  message?: string;
  space?: { name: string; area: string };
  booking?: {
    id: string;
    date: string;
    startTime: string;
    hours: number;
    status: string;
    refundStatus?: string;
    guestName?: string;
    totalAmount?: number;
  };
}

export async function requestBookingAccess(bookingId: string): Promise<BookingAccessPayload> {
  const token = getBookingToken(bookingId);
  let bearer = "";
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    bearer = data.session?.access_token ?? "";
  }
  const response = await fetch("/api/bookings/access", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify({ bookingId, token: token ?? "" }),
  });
  const payload = (await response.json().catch(() => null)) as (BookingAccessPayload & { error?: string }) | null;
  if (!response.ok) {
    throw new Error(payload?.error ?? "예약 정보를 확인하지 못했어요.");
  }
  return payload as BookingAccessPayload;
}

/**
 * 확정된 예약에만 상세주소·출입 안내를 보여 준다.
 * 확정 전에는 왜 볼 수 없는지 안내만 한다.
 */
export function PrivateInfoPanel({ booking, compact = false }: { booking: Booking; compact?: boolean }) {
  const [state, setState] = useState<BookingAccessPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setState(null);
    setError("");
    setOpen(false);
  }, [booking.id, booking.status]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setState(await requestBookingAccess(booking.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "예약 정보를 확인하지 못했어요.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (booking.status === "confirmed") void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.id, booking.status]);

  if (booking.status !== "confirmed") {
    return (
      <div className={cn("rounded-xl border border-ink-line bg-ink-line/25 px-3 py-2.5 text-[10.5px] leading-relaxed text-ink-mute", compact && "text-[10px]")}>
        🔒 상세주소·출입 안내는 <b className="text-ink-soft">입금 확인으로 예약이 확정된 뒤</b>에 공개돼요.
      </div>
    );
  }

  const access = state?.access;
  const hasAccess = Boolean(access && (access.detailAddress || access.entryGuide || access.parkingGuide));

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2.5 text-[11px] leading-relaxed text-emerald-800">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1 font-extrabold">
          <CheckIcon size={12} /> 예약 확정 · 상세 안내
        </p>
        <button type="button" onClick={() => setOpen((value) => !value)} className="text-[10px] font-bold underline">
          {open ? "접기" : "보기"}
        </button>
      </div>

      {error && <p className="mt-1 text-[10.5px] text-red-500">{error}</p>}
      {loading && <p className="mt-1 text-[10.5px] text-emerald-700">불러오는 중…</p>}

      {open && !loading && !error && (
        <div className="mt-2 space-y-1.5 text-[11px] text-emerald-900">
          {!hasAccess && <p>사장님이 아직 상세주소·출입 안내를 등록하지 않았어요. 사장님께 문의해 주세요.</p>}
          {access?.detailAddress && (
            <p>
              <b>상세주소</b> · {access.detailAddress}
            </p>
          )}
          {access?.entryGuide && (
            <p className="whitespace-pre-line">
              <b>출입 안내</b> · {access.entryGuide}
            </p>
          )}
          {access?.parkingGuide && (
            <p className="whitespace-pre-line">
              <b>주차</b> · {access.parkingGuide}
            </p>
          )}
        </div>
      )}
      {!open && (
        <p className="mt-0.5 text-[10px] text-emerald-700/80">
          {state?.space?.area ? `${state.space.area} · ` : ""}정확한 위치와 출입 방법을 확인하세요. 본인과 예약자만 볼 수 있어요.
        </p>
      )}
    </div>
  );
}

/** 예약 상태 변경 이력 타임라인 */
export function BookingTimeline({ events, defaultOpen = false }: { events: BookingEvent[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (events.length === 0) return null;

  return (
    <div className="mt-2 rounded-xl bg-ink-line/20 px-2.5 py-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 text-[10px] font-bold text-ink-soft"
      >
        <span className="inline-flex items-center gap-1">
          <ClockIcon size={11} /> 변경 이력 {events.length}건
        </span>
        <span className="text-ink-mute">{open ? "접기" : "펼치기"}</span>
      </button>
      {open && (
        <ol className="mt-1.5 space-y-1 border-l border-ink-line pl-2.5">
          {events.map((event) => (
            <li key={event.id} className="text-[10px] leading-relaxed text-ink-soft">
              <span className="font-bold text-ink">{EVENT_LABEL[event.eventType] ?? event.eventType}</span>
              <span className="text-ink-mute">
                {" "}
                · {ACTOR_LABEL[event.actor] ?? event.actor} ·{" "}
                {new Date(event.createdAt).toLocaleString("ko-KR", {
                  month: "numeric",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              {event.memo && event.eventType === "refund_memo" && (
                <span className="block text-ink-mute">“{event.memo}”</span>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** 예약 상세 한 줄 (링크로 들어온 비로그인 손님용) */
export function GuestBookingSummary({ payload }: { payload: BookingAccessPayload }) {
  const booking = payload.booking;
  if (!booking) return null;
  return (
    <div className="rounded-2xl bg-white p-4 text-xs shadow-card">
      <p className="text-[11px] font-bold text-brand">{payload.space?.name ?? "예약"}</p>
      <p className="mt-1 text-sm font-extrabold text-ink">
        {formatDate(booking.date)} {formatTime(booking.startTime)} · {booking.hours}시간
      </p>
      <p className="mt-0.5 text-[11px] text-ink-mute">
        {booking.status === "confirmed" ? "예약 확정" : booking.status === "cancelled" ? "취소됨" : "입금 대기"}
        {payload.space?.area ? ` · ${payload.space.area}` : ""}
      </p>
    </div>
  );
}
