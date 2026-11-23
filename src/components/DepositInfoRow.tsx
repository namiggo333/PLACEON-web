"use client";

import { useEffect, useState } from "react";
import { ClockIcon, HourglassIcon } from "@/components/Icons";
import { formatDeadline, formatRemaining } from "@/components/DepositGuide";
import { cn, won } from "@/lib/format";
import type { Booking } from "@/lib/types";

/**
 * 사장님 센터·총괄 관리자용 입금 정보 요약.
 * pending 이면 남은 시간을 실시간으로 보여 주고, 손님이 '입금했어요'를 누르면 '확인 중'으로 바뀐다.
 * 입금자명·금액을 크게 보여 사장님이 통장과 바로 대조할 수 있게 한다.
 */
export function DepositInfoRow({
  booking,
  className,
}: {
  booking: Pick<
    Booking,
    | "status"
    | "expiresAt"
    | "payBankName"
    | "payAccountNumber"
    | "payAccountHolder"
    | "totalAmount"
    | "cancelReason"
    | "paidClaimedAt"
    | "depositorName"
    | "guestName"
  >;
  className?: string;
}) {
  const pending = booking.status === "pending";
  const claimed = Boolean(booking.paidClaimedAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [pending]);

  if (booking.status === "cancelled" && booking.cancelReason === "expired") {
    return (
      <div className={cn("rounded-lg bg-slate-100 px-2.5 py-2 text-[12px] font-semibold text-slate-500", className)}>
        입금 기한 만료 · 자동 취소됨 (그 시간대는 다시 예약 가능)
      </div>
    );
  }

  if (!pending) return null;

  const deadline = booking.expiresAt ? new Date(booking.expiresAt).getTime() : null;
  const remaining = deadline ? deadline - now : null;
  const expired = !claimed && remaining !== null && remaining <= 0;
  const urgent = !claimed && remaining !== null && remaining <= 5 * 60 * 1000;
  const hasAccount = Boolean(
    booking.payBankName.trim() && booking.payAccountNumber.trim() && booking.payAccountHolder.trim()
  );

  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5 text-[13px] leading-relaxed",
        claimed ? "border-[#C9DBFF] bg-[#E8F0FF]" : expired ? "border-red-200 bg-red-50" : "border-brand/20 bg-brand-light/60",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 font-extrabold",
            claimed ? "text-[#1D4ED8]" : expired ? "text-red-500" : "text-brand-dark"
          )}
        >
          {claimed ? <HourglassIcon size={13} /> : <ClockIcon size={13} />}
          {claimed ? "입금 확인 중" : "입금 대기"}
        </span>
        <span
          className={cn(
            "font-extrabold tabular-nums",
            claimed ? "text-[#1D4ED8]" : expired ? "text-red-500" : urgent ? "text-red-500" : "text-brand-dark"
          )}
        >
          {claimed
            ? "입금 신호 도착"
            : expired
              ? "기한 지남"
              : remaining !== null
                ? `남은 ${formatRemaining(remaining)}`
                : "15분"}
        </span>
      </div>

      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[18px] font-extrabold text-ink">{won(booking.totalAmount)}</span>
        <span className="text-[13px] font-bold text-ink">· 입금자 {booking.depositorName || booking.guestName}</span>
      </div>

      <p className="mt-0.5 font-semibold text-ink-soft">
        {hasAccount
          ? `${booking.payBankName} ${booking.payAccountNumber} (예금주 ${booking.payAccountHolder})`
          : "입금 계좌 미등록 · 공간 수정에서 계좌를 등록해 주세요"}
      </p>
      <p className="text-ink-mute">
        {booking.expiresAt ? `${formatDeadline(booking.expiresAt)} 까지` : "접수 후 15분"}
        {claimed ? " · 손님이 입금했다고 알려왔어요" : ""}
      </p>
    </div>
  );
}
