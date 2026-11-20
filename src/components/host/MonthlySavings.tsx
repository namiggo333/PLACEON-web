"use client";

import { useMemo, useState } from "react";
import { BoltIcon, SparkleIcon } from "@/components/Icons";
import { cn, won, wonShort } from "@/lib/format";
import {
  PLATFORM_COMMISSION_RATE,
  computeMonthlyReport,
  monthKey,
  monthLabel,
  recentMonths,
  type ReportBookingLike,
} from "@/lib/report";
import type { Booking } from "@/lib/types";

/**
 * 월간 절감 리포트 카드 (6~10단계 9번).
 * 확정 예약(source='guest', status='confirmed')만 집계하고 시간 차단·취소는 뺀다.
 */
export function MonthlySavings({ bookings }: { bookings: Booking[] }) {
  const [month, setMonth] = useState(monthKey());
  const months = useMemo(() => recentMonths(6).reverse(), []);

  const report = useMemo(() => {
    const rows: ReportBookingLike[] = bookings.map((booking) => ({
      spaceId: booking.spaceId,
      spaceName: booking.spaceName,
      channel: booking.channel,
      totalAmount: booking.totalAmount,
      status: booking.status,
      source: booking.source,
      date: booking.date,
    }));
    return computeMonthlyReport(rows, month);
  }, [bookings, month]);

  const linkShare = report.totalRevenue > 0 ? Math.round((report.linkRevenue / report.totalRevenue) * 100) : 0;

  return (
    <section className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-light text-brand-dark">
            <BoltIcon size={18} />
          </span>
          <div>
            <h2 className="text-sm font-extrabold text-ink">월간 절감 리포트</h2>
            <p className="text-[10px] text-ink-mute">
              확정 예약 매출과 타 플랫폼(수수료 10%) 대비 아낀 수수료를 계산해요.
            </p>
          </div>
        </div>
        <select
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          className="input h-9 max-w-[150px] text-[11px]"
          aria-label="리포트 월 선택"
        >
          {months.map((item) => (
            <option key={item} value={item}>
              {monthLabel(item)}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl bg-brand-light p-3">
          <p className="text-[10px] font-bold text-brand-dark/80">확정 매출</p>
          <p className="mt-0.5 text-xl font-extrabold text-brand-dark">{wonShort(report.totalRevenue)}</p>
          <p className="text-[9.5px] text-brand-dark/70">{report.bookingCount}건 · 취소·차단 제외</p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3">
          <p className="text-[10px] font-bold text-emerald-700/80">아낀 수수료</p>
          <p className="mt-0.5 text-xl font-extrabold text-emerald-600">{wonShort(report.savedFee)}</p>
          <p className="text-[9.5px] text-emerald-700/70">{Math.round(PLATFORM_COMMISSION_RATE * 100)}% 기준</p>
        </div>
        <div className="rounded-xl bg-ink-line/30 p-3">
          <p className="text-[10px] font-bold text-ink-mute">전용 링크 매출</p>
          <p className="mt-0.5 text-xl font-extrabold text-ink">{wonShort(report.linkRevenue)}</p>
          <p className="text-[9.5px] text-ink-mute">{report.linkCount}건 · 전체 {linkShare}%</p>
        </div>
        <div className="rounded-xl bg-ink-line/30 p-3">
          <p className="text-[10px] font-bold text-ink-mute">사이트 유입 매출</p>
          <p className="mt-0.5 text-xl font-extrabold text-ink">{wonShort(report.webRevenue)}</p>
          <p className="text-[9.5px] text-ink-mute">{report.bookingCount - report.linkCount}건</p>
        </div>
      </div>

      {report.totalRevenue > 0 && (
        <div className="mt-3">
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-ink-line/40">
            <div className="h-full bg-brand" style={{ width: `${Math.max(2, linkShare)}%` }} />
            <div className="h-full flex-1 bg-ink/20" />
          </div>
          <div className="mt-1 flex justify-between text-[9.5px] text-ink-mute">
            <span>전용 링크 {won(report.linkRevenue)}</span>
            <span>사이트 유입 {won(report.webRevenue)}</span>
          </div>
        </div>
      )}

      {report.spaces.length > 0 ? (
        <div className="mt-3 divide-y divide-ink-line">
          {report.spaces.map((space) => (
            <div key={space.spaceId} className="flex items-center gap-2 py-2">
              <span className="min-w-0 flex-1 truncate text-[11.5px] font-bold text-ink">{space.spaceName}</span>
              <span className="text-[10px] text-ink-mute">
                {space.count}건{space.linkCount > 0 ? ` · 링크 ${space.linkCount}` : ""}
              </span>
              <span className="w-[86px] text-right text-[11.5px] font-extrabold text-ink">{won(space.revenue)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-lg bg-ink-line/25 px-3 py-6 text-center text-[11px] text-ink-mute">
          이 달에는 확정된 예약이 없어요. 예약을 확정하면 매출과 아낀 수수료가 여기에 쌓입니다.
        </p>
      )}

      <p className={cn("mt-3 flex items-start gap-1.5 rounded-lg bg-ink-line/25 px-2.5 py-2 text-[10px] leading-relaxed text-ink-mute")}>
        <SparkleIcon size={12} className="mt-0.5 shrink-0 text-brand-dark" />
        <span>
          매월 1일에 지난달 리포트를 사장님 메일로도 보내 드려요. 수수료 비교는 타 공간대여 플랫폼의 일반적인 중개 수수료
          10% 를 가정한 값이고, 이곳저곳 수수료는 지금 0% 입니다.
        </span>
      </p>
    </section>
  );
}
