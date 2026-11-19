import type { Booking } from "./types";

/**
 * 월간 절감 리포트 (6~10단계 9번).
 *
 * - 매출은 `source='guest'` + `status='confirmed'` 만 센다. 취소·시간 차단(block)은 제외.
 * - 전용 결제 링크(`channel='link'`) 매출과 사이트(`web`) 매출을 나눠 보여 준다.
 * - "아낀 수수료"는 타 공간대여 플랫폼의 일반적인 중개 수수료 10% 를 기준으로 계산한 비교값이다.
 *   (이곳저곳은 현재 수수료 0%)
 */

export const PLATFORM_COMMISSION_RATE = 0.1;

export interface ReportBookingLike {
  spaceId: string;
  spaceName: string;
  channel: "web" | "link";
  totalAmount: number;
  status: "pending" | "confirmed" | "cancelled";
  source: "guest" | "block";
  date: string;
}

export interface SpaceBreakdown {
  spaceId: string;
  spaceName: string;
  revenue: number;
  linkRevenue: number;
  count: number;
  linkCount: number;
}

export interface MonthlyReport {
  month: string;
  label: string;
  totalRevenue: number;
  linkRevenue: number;
  webRevenue: number;
  bookingCount: number;
  linkCount: number;
  savedFee: number;
  commissionRate: number;
  spaces: SpaceBreakdown[];
}

export function monthKey(base = new Date()): string {
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return monthKey(date);
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return `${y}년 ${m}월`;
}

/** 최근 n개월(이번 달 포함) 목록 — 오래된 것부터 */
export function recentMonths(count = 6, base = new Date()): string[] {
  const current = monthKey(base);
  return Array.from({ length: count }, (_, index) => shiftMonth(current, index - (count - 1)));
}

export function countForRevenue(booking: Pick<ReportBookingLike, "status" | "source">): boolean {
  return booking.status === "confirmed" && booking.source !== "block";
}

export function computeMonthlyReport(
  bookings: ReportBookingLike[],
  month: string,
  commissionRate = PLATFORM_COMMISSION_RATE
): MonthlyReport {
  const counted = bookings.filter((booking) => booking.date.startsWith(month) && countForRevenue(booking));
  const bySpace = new Map<string, SpaceBreakdown>();
  let totalRevenue = 0;
  let linkRevenue = 0;

  for (const booking of counted) {
    totalRevenue += booking.totalAmount;
    if (booking.channel === "link") linkRevenue += booking.totalAmount;
    const key = booking.spaceId;
    const row =
      bySpace.get(key) ??
      ({ spaceId: booking.spaceId, spaceName: booking.spaceName, revenue: 0, linkRevenue: 0, count: 0, linkCount: 0 } as SpaceBreakdown);
    row.revenue += booking.totalAmount;
    row.count += 1;
    if (booking.channel === "link") {
      row.linkRevenue += booking.totalAmount;
      row.linkCount += 1;
    }
    bySpace.set(key, row);
  }

  return {
    month,
    label: monthLabel(month),
    totalRevenue,
    linkRevenue,
    webRevenue: totalRevenue - linkRevenue,
    bookingCount: counted.length,
    linkCount: counted.filter((booking) => booking.channel === "link").length,
    savedFee: Math.round(totalRevenue * commissionRate),
    commissionRate,
    spaces: Array.from(bySpace.values()).sort((a, b) => b.revenue - a.revenue),
  };
}

export function won(value: number): string {
  return `${Math.round(Number(value) || 0).toLocaleString("ko-KR")}원`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SITE_URL = (process.env.SITE_URL ?? "https://igotjeogot.vercel.app").replace(/\/$/, "");

/** 월간 자동 메일 HTML — 예약 알림 메일과 같은 브랜드 톤 */
export function renderMonthlyReportHtml(args: {
  hostName: string;
  report: MonthlyReport;
}): { subject: string; html: string; text: string } {
  const { report } = args;
  const subject = `[이곳저곳] ${report.label} 절감 리포트 · 수수료 ${won(report.savedFee)} 아꼈어요`;

  const spaceRows = report.spaces
    .map(
      (space) => `
        <tr>
          <td style="padding:9px 0;border-bottom:1px solid #F1E6EC;font-size:12px;color:#4A3F47;">${escapeHtml(space.spaceName)}</td>
          <td style="padding:9px 0;border-bottom:1px solid #F1E6EC;font-size:12px;color:#8A7C86;text-align:right;">${space.count}건</td>
          <td style="padding:9px 0;border-bottom:1px solid #F1E6EC;font-size:12px;font-weight:700;color:#1B1624;text-align:right;">${won(space.revenue)}</td>
        </tr>`
    )
    .join("");

  const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:24px 12px;background:#FDF2F8;font-family:'Apple SD Gothic Neo','Malgun Gothic',system-ui,-apple-system,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 24px rgba(27,22,36,0.06);">
    <tr>
      <td style="background:#FF2E7E;padding:22px 24px;color:#ffffff;">
        <div style="font-size:12px;letter-spacing:0.08em;opacity:0.9;">이곳저곳 · 월간 절감 리포트</div>
        <div style="margin-top:6px;font-size:21px;font-weight:800;">${escapeHtml(report.label)} 수수료 ${won(report.savedFee)} 아꼈어요</div>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 24px 6px;">
        <p style="margin:0 0 14px;font-size:13px;line-height:1.7;color:#4A3F47;">
          ${escapeHtml(args.hostName)} 사장님, ${escapeHtml(report.label)} 예약 ${report.bookingCount}건으로 매출 ${won(
            report.totalRevenue
          )} 를 기록했어요. 같은 매출을 수수료 10% 플랫폼에서 냈다면 ${won(
            report.savedFee
          )} 를 수수료로 내셨어야 해요. 이곳저곳 수수료는 0원입니다.
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
          <tr>
            <td style="padding:12px;background:#FFF0F6;border-radius:12px 0 0 12px;width:50%;">
              <div style="font-size:11px;color:#B0135A;">확정 매출</div>
              <div style="margin-top:4px;font-size:18px;font-weight:800;color:#E01B6B;">${won(report.totalRevenue)}</div>
            </td>
            <td style="padding:12px;background:#F3FBF7;border-radius:0 12px 12px 0;width:50%;">
              <div style="font-size:11px;color:#0F7A4C;">아낀 수수료 (10% 기준)</div>
              <div style="margin-top:4px;font-size:18px;font-weight:800;color:#0F9D58;">${won(report.savedFee)}</div>
            </td>
          </tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;">
          <tr><td style="padding:8px 0;font-size:12px;color:#8A7C86;">전용 결제 링크 매출</td><td style="padding:8px 0;font-size:12px;font-weight:700;text-align:right;color:#1B1624;">${won(
            report.linkRevenue
          )} · ${report.linkCount}건</td></tr>
          <tr><td style="padding:8px 0;font-size:12px;color:#8A7C86;">사이트(이곳저곳) 유입 매출</td><td style="padding:8px 0;font-size:12px;font-weight:700;text-align:right;color:#1B1624;">${won(
            report.webRevenue
          )} · ${report.bookingCount - report.linkCount}건</td></tr>
        </table>
        ${
          spaceRows
            ? `<div style="margin-top:16px;font-size:12px;font-weight:800;color:#1B1624;">공간별 매출</div>
               <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${spaceRows}</table>`
            : ""
        }
        <p style="margin:14px 0 0;font-size:11px;line-height:1.6;color:#9B8E96;">
          취소된 예약과 사장님 시간 차단은 집계에서 제외했어요. 수수료 비교는 타 공간대여 플랫폼의 일반적인 중개 수수료 10% 를 가정한 값입니다.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 24px 26px;">
        <a href="${SITE_URL}/host" style="display:inline-block;background:#FF2E7E;color:#ffffff;text-decoration:none;font-size:13px;font-weight:800;padding:12px 20px;border-radius:12px;">사장님 센터에서 리포트 보기</a>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 24px;background:#FFF7FA;color:#A899A1;font-size:10px;line-height:1.6;">
        이곳저곳 · 공간대여 예약 플랫폼 · 매월 1일 전월 리포트를 보내 드립니다.
      </td>
    </tr>
  </table>
</body></html>`;

  const text = [
    `이곳저곳 · ${report.label} 절감 리포트`,
    "",
    `${args.hostName} 사장님, ${report.label} 확정 예약 ${report.bookingCount}건 / 매출 ${won(report.totalRevenue)}`,
    `- 아낀 수수료(10% 기준): ${won(report.savedFee)}`,
    `- 전용 결제 링크 매출: ${won(report.linkRevenue)} (${report.linkCount}건)`,
    `- 사이트 유입 매출: ${won(report.webRevenue)} (${report.bookingCount - report.linkCount}건)`,
    "",
    ...report.spaces.map((space) => `- ${space.spaceName}: ${won(space.revenue)} (${space.count}건)`),
    "",
    `사장님 센터: ${SITE_URL}/host`,
  ].join("\n");

  return { subject, html, text };
}
