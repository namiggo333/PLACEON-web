"use client";

import { useEffect, useState } from "react";
import { ClockIcon } from "@/components/Icons";
import { formatDeadline, formatRemaining } from "@/components/DepositGuide";
import { cn, won } from "@/lib/format";
import type { Booking } from "@/lib/types";

/**
 * 사장님 센터·총괄 관리자용 입금 정보 요약.
 * pending 이면 남은 시간을 실시간으로 보여 주고, 기한이 지나면 만료로 표시한다.
 */
export function DepositInfoRow({
  booking,
  className,
}: {
  booking: Pick<
    Booking,
    "status" | "expiresAt" | "payBankName" | "payAccountNumber" | "payAccountHolder" | "totalAmount" | "cancelReason"
  >;
  className?: string;
}) {
  const pending = booking.status === "pending";
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [pending]);

  if (booking.status === "cancelled" && booking.cancelReason === "expired") {
    return (
      <div className={cn("rounded-lg bg-slate-100 px-2.5 py-2 text-[11.5px] font-semibold text-slate-500", className)}>
        입금 기한 만료 · 자동 취소됨 (그 시간대는 다시 예약 가능)
      </div>
    );
  }

  if (!pending) return null;

  const deadline = booking.expiresAt ? new Date(booking.expiresAt).getTime() : null;
  const remaining = deadline ? deadline - now : null;
  const expired = remaining !== null && remaining <= 0;
  const hasAccount = Boolean(
    booking.payBankName.trim() && booking.payAccountNumber.trim() && booking.payAccountHolder.trim()
  );

  return (
    <div
      className={cn(
        "rounded-lg border px-2.5 py-2 text-[11.5px] leading-relaxed",
        expired ? "border-red-200 bg-red-50" : "border-brand/20 bg-brand-light/60",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("inline-flex items-center gap-1 font-extrabold", expired ? "text-red-500" : "text-brand-dark")}>
          <ClockIcon size={11} />
          입금 대기
        </span>
        <span className={cn("font-extrabold tabular-nums", expired ? "text-red-500" : "text-brand-dark")}>
          {expired ? "기한 지남" : remaining !== null ? `남은 ${formatRemaining(remaining)}` : "15분"}
        </span>
      </div>
      <p className="mt-0.5 font-semibold text-ink">
        {hasAccount
          ? `${booking.payBankName} ${booking.payAccountNumber} (예금주 ${booking.payAccountHolder})`
          : "입금 계좌 미등록 · 공간 수정에서 계좌를 등록해 주세요"}
      </p>
      <p className="text-ink-mute">
        {won(booking.totalAmount)}
        {booking.expiresAt ? ` · ${formatDeadline(booking.expiresAt)} 까지` : ""}
      </p>
    </div>
  );
}
