"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckIcon, ClockIcon, CopyIcon } from "@/components/Icons";
import { cn, won } from "@/lib/format";
import type { Booking } from "@/lib/types";

export function isDepositExpired(booking: Pick<Booking, "status" | "expiresAt">): boolean {
  if (booking.status !== "pending") return false;
  if (!booking.expiresAt) return false;
  const time = new Date(booking.expiresAt).getTime();
  return Number.isFinite(time) && time <= Date.now();
}

/** 남은 시간을 "08:42" 형태로 */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatDeadline(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("month")}월 ${get("day")}일 ${get("dayPeriod")} ${get("hour")}:${get("minute")}`;
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

/**
 * 손님에게 보이는 입금 안내 박스.
 * 예약 접수 직후 화면과 /bookings 에서 같은 내용을 보여 준다.
 */
export function DepositGuide({
  booking,
  className,
  compact = false,
}: {
  booking: Pick<
    Booking,
    | "status"
    | "totalAmount"
    | "expiresAt"
    | "payBankName"
    | "payAccountNumber"
    | "payAccountHolder"
    | "cancelReason"
    | "startTime"
    | "hours"
  >;
  className?: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const pending = booking.status === "pending";
  const now = useNow(pending);
  const expiry = booking.expiresAt ? new Date(booking.expiresAt).getTime() : null;
  const remaining = expiry ? expiry - now : null;
  const expired = isDepositExpired(booking);
  const hasAccount = Boolean(
    booking.payBankName.trim() && booking.payAccountNumber.trim() && booking.payAccountHolder.trim()
  );

  const accountText = useMemo(
    () => `${booking.payBankName} ${booking.payAccountNumber} (예금주 ${booking.payAccountHolder})`,
    [booking.payBankName, booking.payAccountNumber, booking.payAccountHolder]
  );

  async function copyAccount() {
    if (!hasAccount) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(`${booking.payBankName} ${booking.payAccountNumber}`);
      } else {
        const area = document.createElement("textarea");
        area.value = `${booking.payBankName} ${booking.payAccountNumber}`;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        document.body.removeChild(area);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* 복사가 막히면 계좌를 그대로 보여 준다 */
    }
  }

  if (booking.status === "confirmed") {
    return (
      <div className={cn("rounded-xl border border-emerald-200 bg-emerald-50 p-3.5", className)}>
        <p className="flex items-center gap-1 text-[11px] font-extrabold text-emerald-700">
          <CheckIcon size={13} />
          입금 확인 완료 · 예약이 확정됐어요
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-emerald-700/80">
          {won(booking.totalAmount)} 입금이 확인되어 예약이 확정됐어요. 이용 당일 뵐게요!
        </p>
      </div>
    );
  }

  if (booking.status === "cancelled") {
    return (
      <div className={cn("rounded-xl border border-ink-line bg-ink-line/30 p-3.5", className)}>
        <p className="text-[11px] font-extrabold text-ink-soft">
          {booking.cancelReason === "expired" ? "입금 기한이 지나 예약이 취소됐어요" : "취소된 예약이에요"}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-mute">
          {booking.cancelReason === "expired"
            ? "15분 안에 입금이 확인되지 않아 예약이 자동으로 풀렸어요. 같은 시간대를 다시 예약할 수 있어요."
            : "다른 시간대로 다시 예약하실 수 있어요."}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-xl border border-brand/25 bg-brand-light", className)}>
      <div className="flex items-center justify-between gap-2 bg-brand/10 px-3.5 py-2">
        <p className="flex items-center gap-1.5 text-[11px] font-extrabold text-brand">
          <ClockIcon size={13} />
          입금 안내 · 15분 안에 입금해 주세요
        </p>
        {pending && remaining !== null && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-black tabular-nums",
              remaining <= 0 ? "bg-slate-200 text-slate-500" : "bg-brand text-white"
            )}
          >
            {remaining <= 0 ? "만료" : formatRemaining(remaining)}
          </span>
        )}
      </div>

      <div className="px-3.5 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-semibold text-ink-mute">입금 금액</span>
          <span className="text-lg font-black text-ink">{won(booking.totalAmount)}</span>
        </div>

        {hasAccount ? (
          <div className="mt-2 space-y-1.5 rounded-lg bg-white/80 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-ink-mute">입금 계좌</span>
              <span className="text-[11px] font-bold text-ink">{booking.payBankName}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-ink-mute">계좌번호</span>
              <button
                type="button"
                onClick={() => void copyAccount()}
                className="inline-flex items-center gap-1 text-[12px] font-extrabold tracking-tight text-ink hover:text-brand"
                title="계좌번호 복사"
              >
                {booking.payAccountNumber}
                <CopyIcon size={12} className={copied ? "text-brand" : "text-ink-mute"} />
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-ink-mute">예금주</span>
              <span className="text-[11px] font-bold text-ink">{booking.payAccountHolder}</span>
            </div>
            <p className="pt-1 text-[10px] text-ink-mute">{copied ? "계좌번호를 복사했어요!" : accountText}</p>
          </div>
        ) : (
          <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2.5">
            <p className="text-[11px] font-bold text-amber-700">입금 계좌가 아직 등록되지 않았어요</p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-amber-700/80">
              사장님이 계좌를 등록하면 예약 내역에서 바로 확인할 수 있어요. 급하시면 사장님께 연락해 계좌를
              문의해 주세요.
            </p>
          </div>
        )}

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold text-ink-mute">입금 기한</span>
          <span className={cn("text-[11px] font-bold", expired ? "text-red-500" : "text-brand")}>
            {booking.expiresAt ? `${formatDeadline(booking.expiresAt)} 까지` : "접수 후 15분"}
          </span>
        </div>

        {!compact && (
          <p className="mt-2.5 border-t border-brand/15 pt-2 text-[10px] leading-relaxed text-ink-soft">
            {expired
              ? "입금 기한이 지났어요. 곧 자동으로 취소되며, 그 시간대는 다른 손님이 예약할 수 있어요."
              : "입금 후 사장님이 [입금 확인]을 누르면 예약이 확정돼요. 기한이 지나면 자동으로 취소됩니다."}
          </p>
        )}
      </div>
    </div>
  );
}
