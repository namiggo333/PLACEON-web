"use client";

import Link from "next/link";

/**
 * 예약 화면 공통 동의 체크 — 이용약관·개인정보처리방침·취소·환불 규정.
 * 체크하지 않으면 예약 버튼이 동작하지 않는다.
 */
export function BookingConsent({
  checked,
  onChange,
  id = "booking-consent",
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  id?: string;
}) {
  return (
    <div className="rounded-xl border border-ink-line bg-white px-3 py-2.5">
      <label htmlFor={id} className="flex cursor-pointer items-start gap-2 text-[12px] leading-relaxed text-ink-soft">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#FF2E7E]"
        />
        <span>
          <span className="font-bold text-brand-dark">[필수]</span> 이용약관, 개인정보 수집·이용, 취소·환불 규정을
          확인했고 이에 동의합니다.
        </span>
      </label>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 pl-6 text-[12px]">
        <Link href="/terms" target="_blank" rel="noreferrer" className="font-semibold text-brand-dark hover:underline">
          이용약관
        </Link>
        <Link href="/privacy" target="_blank" rel="noreferrer" className="font-semibold text-brand-dark hover:underline">
          개인정보처리방침
        </Link>
        <Link href="/refund" target="_blank" rel="noreferrer" className="font-semibold text-brand-dark hover:underline">
          취소·환불 규정
        </Link>
      </div>
    </div>
  );
}
