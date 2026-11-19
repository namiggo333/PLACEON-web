import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendMail } from "@/lib/mail";
import { computeMonthlyReport, monthKey, renderMonthlyReportHtml, shiftMonth } from "@/lib/report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 월간 아낀 수수료 리포트 메일 (매월 1일 실행).
 *
 *   GET/POST /api/cron/monthly-report?month=2026-11&key=CRON_SECRET
 *     - month 생략 시 "지난달" (Asia/Seoul 기준)
 *     - host=<uuid> 로 특정 사장님만, dry=1 로 메일 없이 집계만 확인
 *
 * 인증은 /api/cron/expire-bookings 와 같은 CRON_SECRET 패턴을 쓴다.
 * CRON_SECRET 이 설정되어 있지 않으면 실제 발송은 하지 않고, dry=1 조회만 허용한다.
 */
function seoulMonth(offset = 0): string {
  const now = new Date();
  const seoul = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const base = monthKey(new Date(seoul.getUTCFullYear(), seoul.getUTCMonth(), 1));
  return shiftMonth(base, offset);
}

function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return { start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, "0")}` };
}

async function handle(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Supabase 환경변수가 비어 있습니다." }, { status: 503 });
  }

  const url = new URL(request.url);
  const secret = process.env.CRON_SECRET;
  const dry = url.searchParams.get("dry") === "1";
  const isVercelCron = Boolean(request.headers.get("x-vercel-cron"));

  if (secret) {
    const authorization = request.headers.get("authorization") ?? "";
    const provided = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
    const queryKey = url.searchParams.get("key") ?? "";
    if (provided !== secret && queryKey !== secret && !isVercelCron) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  } else if (!dry) {
    return NextResponse.json(
      { error: "CRON_SECRET 이 설정되지 않아 실제 발송은 막혀 있습니다. (dry=1 로 집계만 확인할 수 있어요)" },
      { status: 503 }
    );
  }

  const monthParam = url.searchParams.get("month") ?? "";
  const month = /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : seoulMonth(-1);
  const hostFilter = (url.searchParams.get("host") ?? "").trim();
  const { start, end } = monthRange(month);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // 한 달치 예약을 1000건 단위로 모두 읽는다.
  const rows: {
    id: string;
    space_id: string;
    space_name: string;
    host_id: string;
    channel: string | null;
    source: string | null;
    status: string;
    total_amount: number;
    date: string;
  }[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    let query = admin
      .from("bookings")
      .select("id, space_id, space_name, host_id, channel, source, status, total_amount, date")
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: true })
      .range(from, from + 999);
    if (hostFilter) query = query.eq("host_id", hostFilter);
    const { data, error } = await query;
    if (error) {
      console.error("[api/cron/monthly-report] 예약 조회 실패", error);
      return NextResponse.json({ error: "예약을 불러오지 못했어요." }, { status: 500 });
    }
    rows.push(...((data ?? []) as typeof rows));
    if ((data ?? []).length < 1000) break;
  }

  const byHost = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byHost.get(row.host_id) ?? [];
    list.push(row);
    byHost.set(row.host_id, list);
  }

  const hostIds = Array.from(byHost.keys());
  const emails = new Map<string, { email: string; name: string }>();
  if (hostIds.length > 0) {
    const { data: profiles } = await admin.from("profiles").select("id, email, name").in("id", hostIds);
    for (const profile of (profiles ?? []) as { id: string; email: string | null; name: string | null }[]) {
      if (profile.email) emails.set(profile.id, { email: profile.email, name: profile.name ?? "사장님" });
    }
  }

  const results: {
    hostId: string;
    hostName: string;
    email: string | null;
    bookingCount: number;
    revenue: number;
    savedFee: number;
    sent: boolean;
    skipped?: string;
    error?: string;
  }[] = [];

  for (const [hostId, list] of byHost) {
    const report = computeMonthlyReport(
      list.map((row) => ({
        spaceId: row.space_id,
        spaceName: row.space_name,
        channel: row.channel === "link" ? "link" : "web",
        totalAmount: Number(row.total_amount) || 0,
        status: row.status === "confirmed" ? "confirmed" : row.status === "cancelled" ? "cancelled" : "pending",
        source: row.source === "block" ? "block" : "guest",
        date: row.date,
      })),
      month
    );

    const profile = emails.get(hostId);
    const entry = {
      hostId,
      hostName: profile?.name ?? "(이름 없음)",
      email: profile?.email ?? null,
      bookingCount: report.bookingCount,
      revenue: report.totalRevenue,
      savedFee: report.savedFee,
      sent: false as boolean,
      skipped: undefined as string | undefined,
      error: undefined as string | undefined,
    };

    // 매출이 없는 사장님께는 보내지 않는다.
    if (report.totalRevenue <= 0) {
      entry.skipped = "no_revenue";
      results.push(entry);
      continue;
    }
    if (dry) {
      entry.skipped = "dry_run";
      results.push(entry);
      continue;
    }
    if (!profile?.email) {
      entry.skipped = "no_email";
      results.push(entry);
      continue;
    }

    const content = renderMonthlyReportHtml({ hostName: profile.name, report });
    const sent = await sendMail({ to: profile.email, subject: content.subject, html: content.html, text: content.text });
    entry.sent = sent.sent;
    entry.skipped = sent.skipped;
    entry.error = sent.error;
    results.push(entry);
  }

  const totals = results.reduce(
    (acc, row) => ({
      revenue: acc.revenue + row.revenue,
      savedFee: acc.savedFee + row.savedFee,
      sent: acc.sent + (row.sent ? 1 : 0),
    }),
    { revenue: 0, savedFee: 0, sent: 0 }
  );

  return NextResponse.json({
    ok: true,
    month,
    range: { start, end },
    dry,
    hosts: results,
    totals,
    at: new Date().toISOString(),
  });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
