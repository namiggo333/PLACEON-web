"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
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

type GuideBooking = Pick<
  Booking,
  | "id"
  | "status"
  | "totalAmount"
  | "expiresAt"
  | "payBankName"
  | "payAccountNumber"
  | "payAccountHolder"
  | "cancelReason"
  | "startTime"
  | "hours"
  | "guestName"
  | "accessToken"
  | "paidClaimedAt"
  | "depositorName"
>;

/**
 * 손님에게 보이는 입금 안내.
 * 단계(① 요청 → ② 입금 → ③ 확정) · 카운트다운 · 계좌 복사 · 입금자명 입력 · '입금했어요'.
 */
export function DepositGuide({
  booking,
  className,
  compact = false,
  token,
}: {
  booking: GuideBooking;
  className?: string;
  compact?: boolean;
  /** 비로그인 예약 확인 토큰 (없으면 브라우저에 저장된 값을 쓴다) */
  token?: string | null;
}) {
  const { claimDeposit } = useApp();
  const [copied, setCopied] = useState(false);
  const [depositor, setDepositor] = useState(booking.depositorName || booking.guestName || "");
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [claimedAt, setClaimedAt] = useState<string | null>(booking.paidClaimedAt ?? null);

  const pending = booking.status === "pending";
  const claimed = Boolean(claimedAt);
  const now = useNow(pending && !claimed);
  const expiry = booking.expiresAt ? new Date(booking.expiresAt).getTime() : null;
  const remaining = expiry ? expiry - now : null;
  const expired = isDepositExpired(booking);
  const hasAccount = Boolean(
    booking.payBankName.trim() && booking.payAccountNumber.trim() && booking.payAccountHolder.trim()
  );

  const accountText = useMemo(
    () => `${booking.payBankName} ${booking.payAccountNumber}`,
    [booking.payBankName, booking.payAccountNumber]
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
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 복사가 막히면 계좌를 그대로 보여 준다 */
    }
  }

  async function submitClaim() {
    setClaimError("");
    if (!depositor.trim()) {
      setClaimError("입금자명을 입력해 주세요. 통장에 찍힌 이름이에요.");
      return;
    }
    setClaiming(true);
    try {
      await claimDeposit(booking.id, depositor.trim(), token);
      setClaimedAt(new Date().toISOString());
    } catch (error) {
      setClaimError(error instanceof Error ? error.message : "입금 신호를 보내지 못했어요.");
    } finally {
      setClaiming(false);
    }
  }

  const steps = (
    <div className="ui-steps" aria-label="예약 진행 단계">
      <div className="ui-step" data-state="done">
        <span className="ui-step-dot">
          <CheckIcon size={13} />
        </span>
        <span className="ui-step-label">요청</span>
      </div>
      <div
        className="ui-step"
        data-state={pending ? (claimed ? "done" : "current") : "done"}
      >
        <span className="ui-step-dot">{claimed || !pending ? <CheckIcon size={13} /> : "2"}</span>
        <span className="ui-step-label">입금</span>
      </div>
      <div className="ui-step" data-state={booking.status === "confirmed" ? "current" : "todo"}>
        <span className="ui-step-dot">{booking.status === "confirmed" ? <CheckIcon size={13} /> : "3"}</span>
        <span className="ui-step-label">확정</span>
      </div>
    </div>
  );

  if (booking.status === "confirmed") {
    return (
      <div className={cn("rounded-xl border border-emerald-200 bg-emerald-50 p-3.5", className)}>
        <div className="mb-2.5">{steps}</div>
        <p className="flex items-center gap-1 text-[13px] font-extrabold text-emerald-700">
          <CheckIcon size={14} />
          입금 확인 완료 · 예약이 확정됐어요
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-emerald-700/80">
          {won(booking.totalAmount)} 입금이 확인되어 예약이 확정됐어요. 이용 당일 뵐게요!
        </p>
      </div>
    );
  }

  if (booking.status === "cancelled") {
    return (
      <div className={cn("rounded-xl border border-ink-line bg-ink-line/30 p-3.5", className)}>
        <p className="text-[13px] font-extrabold text-ink-soft">
          {booking.cancelReason === "expired" ? "입금 기한이 지나 예약이 취소됐어요" : "취소된 예약이에요"}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-mute">
          {booking.cancelReason === "expired"
            ? "입금이 확인되지 않아 예약이 자동으로 풀렸어요. 같은 시간대를 다시 예약할 수 있어요."
            : "다른 시간대로 다시 예약하실 수 있어요."}
        </p>
      </div>
    );
  }

  const urgent = remaining !== null && remaining <= 5 * 60 * 1000;

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-brand/25 bg-white", className)}>
      <div className="bg-brand-light/80 px-4 pt-3 pb-2.5">{steps}</div>

      <div className="px-4 py-3.5">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "ui-badge",
              claimed ? "ui-badge--check" : expired ? "ui-badge--closed" : "ui-badge--pay"
            )}
          >
            <ClockIcon size={14} />
            {claimed ? "확인 중" : expired ? "기한 만료" : "입금 대기"}
          </span>
          {!claimed && remaining !== null && (
            <span className={cn("ui-countdown", urgent && "is-urgent")} aria-live="polite">
              {remaining <= 0 ? "00:00" : formatRemaining(remaining)}
            </span>
          )}
        </div>

        <p className="mt-1 text-[13px] font-semibold text-ink-soft">
          {claimed
            ? "입금 신호를 보냈어요. 사장님이 확인하면 메일로 알려드려요."
            : expired
              ? "입금 기한이 지났어요. 곧 자동으로 취소돼요."
              : `입금 기한 ${booking.expiresAt ? `${formatDeadline(booking.expiresAt)}까지` : "접수 후 15분"}`}
        </p>

        <div className="mt-3 flex items-baseline justify-between gap-2 rounded-xl bg-ink-line/30 px-3 py-2.5">
          <span className="text-[13px] font-semibold text-ink-mute">입금 금액</span>
          <span className="text-[24px] font-extrabold leading-none text-ink">{won(booking.totalAmount)}</span>
        </div>

        {hasAccount ? (
          <div className="mt-2.5 rounded-xl border border-ink-line px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-ink-mute">입금 계좌</span>
              <span className="text-[14px] font-bold text-ink">{booking.payBankName}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="ui-account-no min-w-0 break-all text-ink">{booking.payAccountNumber}</span>
              <button
                type="button"
                onClick={() => void copyAccount()}
                className="ui-copy-btn inline-flex shrink-0 items-center justify-center gap-1"
              >
                <CopyIcon size={15} />
                {copied ? "복사됨" : "복사"}
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-ink-mute">예금주</span>
              <span className="text-[14px] font-bold text-ink">{booking.payAccountHolder}</span>
            </div>
            <p className="mt-2 rounded-lg bg-brand-light/70 px-2.5 py-2 text-[13px] font-semibold leading-relaxed text-brand-strong">
              예약자 이름과 <b>같은 이름</b>으로 입금해 주세요. 다르면 아래에 입금자명을 적어 주세요.
            </p>
          </div>
        ) : (
          <div className="mt-2.5 rounded-xl bg-amber-50 px-3 py-2.5">
            <p className="text-[13px] font-bold text-amber-800">입금 계좌가 아직 등록되지 않았어요</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-amber-700">
              사장님이 계좌를 등록하면 예약 내역에서 바로 확인할 수 있어요. 급하시면 사장님께 연락해 계좌를
              문의해 주세요.
            </p>
          </div>
        )}

        {!claimed && !expired && (
          <div className="mt-3">
            <label className="mb-1 block text-[13px] font-semibold text-ink-soft" htmlFor={`depositor-${booking.id}`}>
              입금자명
            </label>
            <div className="flex gap-2">
              <input
                id={`depositor-${booking.id}`}
                value={depositor}
                onChange={(event) => setDepositor(event.target.value)}
                placeholder="통장에 찍힌 이름"
                className="input flex-1"
                autoComplete="name"
              />
              <button
                type="button"
                onClick={() => void submitClaim()}
                disabled={claiming}
                className="ui-cta-btn shrink-0 px-4 text-[15px] disabled:opacity-60"
                style={{ minWidth: 104, height: 48, flex: "none" }}
              >
                {claiming ? "보내는 중…" : "입금했어요"}
              </button>
            </div>
            {claimError && <p className="mt-1.5 text-[13px] font-semibold text-red-600">{claimError}</p>}
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-mute">
              누르면 15분 자동 취소가 멈추고, 사장님이 입금을 확인할 때까지 예약이 유지돼요.
            </p>
          </div>
        )}

        {claimed && (
          <div className="mt-3 rounded-xl bg-[#E8F0FF] px-3 py-2.5">
            <p className="text-[13px] font-bold text-[#1D4ED8]">입금자명 {booking.depositorName || depositor}</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-[#1D4ED8]/80">
              사장님이 확인하면 예약이 확정되고 메일로 알려드려요. 화면을 새로 고치면 상태가 갱신됩니다.
            </p>
          </div>
        )}

        {!compact && (
          <p className="mt-2.5 border-t border-ink-line pt-2 text-[12px] leading-relaxed text-ink-mute">
            입금 후 사장님이 [입금 확인]을 누르면 예약이 확정돼요. 확정되면 상세주소·출입 안내가 열립니다.
          </p>
        )}
      </div>
    </div>
  );
}
