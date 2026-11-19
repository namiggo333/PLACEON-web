import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { buildIcsCalendar, type IcsSourceEvent } from "@/lib/ical";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 공간 일정 iCal 피드 — 사장님 전용 구독 주소.
 *   GET /api/spaces/[id]/ical?token=<space_ical_tokens.token>
 *
 * - 토큰이 맞아야만 응답한다(토큰을 모르면 아무 정보도 내려가지 않는다).
 * - 손님 이름·연락처는 넣지 않고 "이곳저곳 예약 / 시간 차단" 요약과 시간만 담는다.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const token = new URL(request.url).searchParams.get("token") ?? "";

  if (!UUID_RE.test(id) || !UUID_RE.test(token)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return new NextResponse("Service unavailable", { status: 503 });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: tokenRow } = await admin
    .from("space_ical_tokens")
    .select("space_id, token")
    .eq("space_id", id)
    .maybeSingle();

  if (!tokenRow || tokenRow.token !== token) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { data: space } = await admin.from("spaces").select("id, name").eq("id", id).maybeSingle();
  if (!space) return new NextResponse("Not found", { status: 404 });

  const { data: rows, error } = await admin
    .from("bookings")
    .select("id, date, start_time, hours, status, source, space_name")
    .eq("space_id", id)
    .in("status", ["pending", "confirmed"])
    .in("source", ["guest", "block"])
    .order("date", { ascending: true })
    .limit(1000);

  if (error) {
    console.error("[api/spaces/ical] 일정 조회 실패", error);
    return new NextResponse("Service unavailable", { status: 500 });
  }

  const events: IcsSourceEvent[] = (rows ?? [])
    .filter((row) => Boolean(row.date) && Boolean(row.start_time))
    .map((row) => ({
      uid: String(row.id),
      kind: row.source === "block" ? "block" : "guest",
      pending: row.status === "pending",
      date: String(row.date),
      startTime: String(row.start_time).slice(0, 5),
      hours: Math.max(1, Math.round(Number(row.hours) || 1)),
    }));

  const ics = buildIcsCalendar({
    calendarName: `이곳저곳 · ${space.name ?? "공간"}`,
    events,
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="igotjeogot-${id.slice(0, 8)}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
