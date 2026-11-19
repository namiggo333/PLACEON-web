"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { DemoAccountButtons } from "@/components/Bits";
import { DepositGuide, isDepositExpired } from "@/components/DepositGuide";
import { InviteCardModal } from "@/components/InviteCard";
import { SpaceMedia } from "@/components/SpaceCard";
import { CalendarIcon, CheckIcon, ClockIcon, LinkIcon, UsersIcon } from "@/components/Icons";
import { MascotAvatar } from "@/components/Logo";
import { REFUND_LABEL, REFUND_STYLE, bookingStatusMeta } from "@/lib/constants";
import {
  BookingTimeline,
  GuestBookingSummary,
  PrivateInfoPanel,
  requestBookingAccess,
  type BookingAccessPayload,
} from "@/components/BookingAccess";
import { saveBookingToken } from "@/lib/db";
import { cn, formatDate, formatRelativeDate, shortId, timeRange, won } from "@/lib/format";
import type { BookingStatus, Role } from "@/lib/types";

const TABS: { key: BookingStatus | "all"; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "pending", label: "대기중" },
  { key: "confirmed", label: "예약확정" },
  { key: "cancelled", label: "취소" },
];

export default function BookingsPage() {
  const { ready, user, bookings, bookingEvents, spaces, setBookingStatus, demoSignIn, mode } = useApp();
  const [tab, setTab] = useState<BookingStatus | "all">("all");
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [demoBusy, setDemoBusy] = useState<Role | null>(null);
  const [inviteBooking, setInviteBooking] = useState<string | null>(null);
  const [guestLink, setGuestLink] = useState<{ id: string; token: string } | null>(null);
  const [guestData, setGuestData] = useState<BookingAccessPayload | null>(null);
  const [guestError, setGuestError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const bookingId = params.get("booking");
    if (!bookingId) return;
    const token = params.get("token") ?? "";
    if (token) saveBookingToken(bookingId, token);
    setGuestLink({ id: bookingId, token });
  }, []);

  useEffect(() => {
    if (!guestLink || user) return;
    let alive = true;
    requestBookingAccess(guestLink.id)
      .then((payload) => {
        if (alive) setGuestData(payload);
      })
      .catch((err) => {
        if (alive) setGuestError(err instanceof Error ? err.message : "예약을 확인하지 못했어요.");
      });
    return () => {
      alive = false;
    };
  }, [guestLink, user]);

  const myBookings = useMemo(
    () =>
      bookings
        .filter((booking) => booking.guestId === user?.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [bookings, user?.id]
  );

  const counts = useMemo(
    () => ({
      all: myBookings.length,
      pending: myBookings.filter((booking) => booking.status === "pending").length,
      confirmed: myBookings.filter((booking) => booking.status === "confirmed").length,
      cancelled: myBookings.filter((booking) => booking.status === "cancelled").length,
    }),
    [myBookings]
  );

  const filtered = tab === "all" ? myBookings : myBookings.filter((booking) => booking.status === tab);

  async function cancel(id: string) {
    setBusyId(id);
    try {
      await setBookingStatus(id, "cancelled");
    } finally {
      setBusyId(null);
      setCancelling(null);
    }
  }

  if (!ready) {
    return (
      <div className="container-page py-10">
        <div className="skeleton h-8 w-40" />
        <div className="mt-6 space-y-3">
          <div className="skeleton h-32 w-full" />
          <div className="skeleton h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!user && guestLink) {
    return (
      <div className="container-page max-w-md py-8 sm:py-12">
        <h1 className="text-xl font-black text-ink">예약 확인</h1>
        <p className="mt-1 text-xs text-ink-mute">
          예약 완료 때 받은 링크로 확인하는 중이에요. 입금이 확인되면 상세주소·출입 안내가 열려요.
        </p>

        {guestError && (
          <div className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-[11px] font-medium text-red-600">{guestError}</div>
        )}
        {guestData && (
          <div className="mt-4 space-y-3">
            <GuestBookingSummary payload={guestData} />
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-[11.5px] leading-relaxed text-emerald-900">
              {guestData.access ? (
                <>
                  <p className="font-extrabold">예약이 확정됐어요 · 상세 안내</p>
                  {guestData.access.detailAddress ? (
                    <p className="mt-1">
                      <b>상세주소</b> · {guestData.access.detailAddress}
                    </p>
                  ) : (
                    <p className="mt-1">사장님이 아직 상세주소를 등록하지 않았어요.</p>
                  )}
                  {guestData.access.entryGuide && (
                    <p className="mt-1 whitespace-pre-line">
                      <b>출입 안내</b> · {guestData.access.entryGuide}
                    </p>
                  )}
                  {guestData.access.parkingGuide && (
                    <p className="mt-1 whitespace-pre-line">
                      <b>주차</b> · {guestData.access.parkingGuide}
                    </p>
                  )}
                </>
              ) : (
                <p>🔒 {guestData.message ?? "예약이 확정된 뒤에 상세주소를 확인할 수 있어요."}</p>
              )}
            </div>
            <Link href="/" className="btn-primary w-full py-3">
              이곳저곳 둘러보기
            </Link>
          </div>
        )}
        {!guestData && !guestError && (
          <div className="mt-4 skeleton h-40 w-full" />
        )}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container-page py-12 sm:py-16">
        <div className="mx-auto max-w-md text-center">
          <MascotAvatar size={88} className="mx-auto" />
          <h1 className="mt-4 text-xl font-black text-ink">로그인하면 예약 내역을 볼 수 있어요</h1>
          <p className="mt-1.5 text-sm text-ink-mute">
            예약 상태 확인과 취소를 한 곳에서 관리해 보세요.
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
              />
            </div>
          )}
          <Link href="/auth?next=/bookings" className="btn-primary mt-5 w-full py-3">
            이메일로 로그인
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">내 예약</h1>
          <p className="mt-1 text-xs text-ink-mute">{user.name} 님의 예약 현황이에요.</p>
        </div>
        <Link href="/search" className="btn-ghost btn-sm">
          새 공간 찾기
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {[
          { label: "대기중", value: counts.pending, tone: "text-amber-600 bg-amber-50" },
          { label: "예약확정", value: counts.confirmed, tone: "text-emerald-600 bg-emerald-50" },
          { label: "취소", value: counts.cancelled, tone: "text-slate-500 bg-slate-100" },
        ].map((item) => (
          <div key={item.label} className={cn("rounded-xl2 p-4", item.tone)}>
            <p className="text-[11px] font-semibold opacity-80">{item.label}</p>
            <p className="mt-0.5 text-2xl font-black">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto border-b border-ink-line">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cn(
              "shrink-0 border-b-2 px-3 pb-2.5 pt-1 text-sm font-bold transition",
              tab === item.key
                ? "border-brand text-brand"
                : "border-transparent text-ink-mute hover:text-ink"
            )}
          >
            {item.label} <span className="text-xs font-semibold">{counts[item.key]}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 px-6 py-14 text-center">
            <MascotAvatar size={76} className="animate-floaty" />
            <p className="mt-1 text-sm font-bold text-ink">아직 예약 내역이 없어요</p>
            <p className="text-xs text-ink-mute">파티룸부터 스터디룸까지, 지금 비어 있는 공간을 찾아보세요.</p>
            <Link href="/search" className="btn-primary btn-sm mt-2">
              공간 찾기
            </Link>
          </div>
        ) : (
          filtered.map((booking) => {
            const space = spaces.find((item) => item.id === booking.spaceId);
            const statusMeta = bookingStatusMeta(booking);
            const depositExpired = isDepositExpired(booking);
            const canCancel = (booking.status === "pending" || booking.status === "confirmed") && !depositExpired;
            return (
              <article key={booking.id} className="card overflow-hidden">
                <div className="flex flex-col gap-4 p-4 sm:flex-row">
                  <div className="h-28 w-full shrink-0 overflow-hidden rounded-xl sm:h-24 sm:w-36">
                    {space ? (
                      <SpaceMedia space={space} showLabel={false} emojiSize="text-3xl" />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-ink-line/50 text-2xl">🏠</div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={cn("badge", statusMeta.style)}>
                            {booking.status === "pending" && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
                            {statusMeta.label}
                          </span>
                          {booking.channel === "link" && (
                            <span className="badge bg-brand-light text-brand">
                              <LinkIcon size={11} />
                              결제 링크 예약
                            </span>
                          )}
                          {booking.status === "cancelled" && booking.refundStatus !== "none" && (
                            <span className={cn("badge", REFUND_STYLE[booking.refundStatus])}>
                              {REFUND_LABEL[booking.refundStatus]}
                            </span>
                          )}
                          <span className="text-[10px] font-medium text-ink-mute">
                            No. {shortId(booking.id)}
                          </span>
                        </div>
                        <h2 className="mt-1.5 truncate text-[15px] font-bold text-ink">{booking.spaceName}</h2>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-extrabold text-ink">{won(booking.totalAmount)}</p>
                        <p className="text-[10px] text-ink-mute">{booking.hours}시간 기준</p>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-soft">
                      <span className="inline-flex items-center gap-1">
                        <CalendarIcon size={13} className="text-ink-mute" />
                        {formatDate(booking.date)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <ClockIcon size={13} className="text-ink-mute" />
                        {timeRange(booking.startTime, booking.hours)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <UsersIcon size={13} className="text-ink-mute" />
                        {booking.guests}명
                      </span>
                      <span className="text-ink-mute">{formatRelativeDate(booking.createdAt)} 신청</span>
                    </div>

                    {booking.memo && (
                      <p className="mt-2 line-clamp-1 rounded-lg bg-ink-line/30 px-2.5 py-1.5 text-[11px] text-ink-soft">
                        요청: {booking.memo}
                      </p>
                    )}

                    <PrivateInfoPanel booking={booking} compact />

                    <BookingTimeline
                      events={bookingEvents.filter((event) => event.bookingId === booking.id)}
                    />

                    {booking.status === "pending" && <DepositGuide booking={booking} className="mt-2.5" compact />}
                    {booking.status === "confirmed" && (
                      <div className="mt-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                        <p className="flex items-start gap-1 text-[11px] font-semibold leading-relaxed text-emerald-700">
                          <CheckIcon size={13} className="mt-0.5 shrink-0" />
                          입금이 확인되어 예약이 확정됐어요. 이용 당일 20분 전까지 도착해 주세요.
                        </p>
                        <p className="mt-1 pl-4 text-[10.5px] leading-relaxed text-emerald-600/90">
                          💌 모임 초대 카드로 친구들에게 바로 공유해 보세요.
                        </p>
                      </div>
                    )}
                    {booking.status === "cancelled" && booking.refundStatus !== "none" && (
                      <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[10.5px] font-semibold text-amber-700">
                        환불 상태 · {REFUND_LABEL[booking.refundStatus]}
                        {booking.refundStatus === "pending" ? " (사장님 확인 후 환불돼요)" : ""}
                      </p>
                    )}
                    {booking.status === "cancelled" && booking.cancelReason === "expired" && (
                      <div className="mt-2.5 rounded-xl border border-ink-line bg-ink-line/30 p-3">
                        <p className="text-[11px] font-semibold leading-relaxed text-ink-soft">
                          15분 안에 입금이 확인되지 않아 예약이 자동으로 풀렸어요. 같은 시간대를 다시 예약할 수
                          있어요.
                        </p>
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {booking.status === "confirmed" && (
                        <button
                          type="button"
                          onClick={() => setInviteBooking(booking.id)}
                          className="btn-primary btn-sm"
                        >
                          💌 모임 초대 카드
                        </button>
                      )}
                      {space && (
                        <Link href={`/spaces/${space.id}`} className="btn-ghost btn-sm">
                          공간 보기
                        </Link>
                      )}
                      {space && (
                        <Link href={`/pay/${space.paySlug}`} className="btn-soft btn-sm">
                          결제 링크
                        </Link>
                      )}
                      {canCancel && (
                        <button
                          type="button"
                          onClick={() => setCancelling(booking.id)}
                          disabled={busyId === booking.id}
                          className="btn-sm rounded-lg border border-ink-line px-3 py-1.5 text-xs font-semibold text-ink-mute transition hover:border-red-200 hover:text-red-500 disabled:opacity-50"
                        >
                          예약 취소
                        </button>
                      )}
                    </div>

                    {cancelling === booking.id && (
                      <div className="mt-3 rounded-xl border border-red-100 bg-red-50/70 p-3">
                        <p className="text-[11px] font-semibold text-red-700">정말 이 예약을 취소할까요?</p>
                        <p className="mt-0.5 text-[10px] text-red-500">
                          이용 3일 전까지 무료 취소, 이후에는 사장님과 협의가 필요해요.
                        </p>
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => cancel(booking.id)}
                            disabled={busyId === booking.id}
                            className="rounded-lg bg-red-500 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-red-600 disabled:opacity-60"
                          >
                            {busyId === booking.id ? "취소 중…" : "취소하기"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setCancelling(null)}
                            className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-bold text-ink-soft"
                          >
                            돌아가기
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      <div className="mt-6 rounded-xl2 border border-ink-line bg-brand-light/50 p-4">
        <p className="text-xs font-bold text-ink">예약 진행 안내</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-[11px] leading-relaxed text-ink-soft">
          <li>예약 신청 후 15분 안에 안내된 계좌로 이용 요금을 입금해 주세요.</li>
          <li>사장님이 입금을 확인하면 예약이 확정되고, 예약 내역에 [예약확정]으로 표시돼요.</li>
          <li>15분 안에 입금이 확인되지 않으면 예약은 자동으로 취소되어 다른 손님이 예약할 수 있어요.</li>
        </ol>
      </div>

      {(() => {
        const target = myBookings.find((booking) => booking.id === inviteBooking);
        if (!target) return null;
        return (
          <InviteCardModal
            booking={target}
            space={spaces.find((item) => item.id === target.spaceId) ?? null}
            open
            onClose={() => setInviteBooking(null)}
          />
        );
      })()}
    </div>
  );
}
