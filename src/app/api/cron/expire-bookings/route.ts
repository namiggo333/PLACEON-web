import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 15분 입금 기한이 지난 pending 예약 정리.
 *
 * 운영에서는 Supabase pg_cron 이 1분마다 `public.expire_pending_bookings()` 를 실행한다.
 * 이 라우트는 같은 처리를 HTTP 로 할 수 있게 해 두는 보조 수단이다.
 *  - Vercel Cron / 외부 스케줄러: `Authorization: Bearer ${CRON_SECRET}` 필요
 *  - 값이 없는 상태의 수동 점검은 `?key=` 없이도 허용하되, 하는 일은 만료 정리뿐이다.
 */
async function handle(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Supabase 환경변수가 비어 있습니다." }, { status: 503 });
  }

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authorization = request.headers.get("authorization") ?? "";
    const provided =
      authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
    const queryKey = new URL(request.url).searchParams.get("key") ?? "";
    const isVercelCron = Boolean(request.headers.get("x-vercel-cron"));
    if (provided !== secret && queryKey !== secret && !isVercelCron) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.rpc("expire_pending_bookings");
  if (error) {
    console.error("[api/cron/expire-bookings] 만료 정리 실패", error);
    return NextResponse.json({ error: "만료 예약을 정리하지 못했어요." }, { status: 500 });
  }

  const expired = typeof data === "number" ? data : Number(data ?? 0);
  return NextResponse.json({ ok: true, expired, at: new Date().toISOString() });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
