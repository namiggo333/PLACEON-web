import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { BookingRow } from "@/lib/mappers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ClaimRequestBody {
  bookingId?: string;
  depositorName?: string;
  token?: string;
}

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * 손님의 '입금했어요' 신호.
 *
 * - 예약 상태를 바꾸지는 않는다(사장님이 확인해야 confirmed). 대신
 *   `paid_claimed_at` 을 남겨 15분 자동 만료를 12시간 보류하고, 손님이 적은
 *   `depositor_name` 을 저장해 사장님이 통장 거래내역과 대조할 수 있게 한다.
 * - 권한: 로그인 본인(예약자·사장님·총괄 관리자) 이거나 예약 접수 때 발급한
 *   access token(DB 에는 해시만 저장)이 일치해야 한다.
 */
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    return fail("지금은 입금 확인 요청을 받을 수 없어요. 잠시 후 다시 시도해 주세요.", 503);
  }

  let body: ClaimRequestBody;
  try {
    body = (await request.json()) as ClaimRequestBody;
  } catch {
    return fail("요청을 읽지 못했어요.");
  }

  const bookingId = (body.bookingId ?? "").trim();
  const depositorName = (body.depositorName ?? "").trim().slice(0, 40);
  const guestToken = (body.token ?? "").trim();
  if (!bookingId) return fail("예약 정보를 다시 확인해 주세요.");

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: bookingData, error: bookingError } = await admin
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();
  if (bookingError) {
    console.error("[api/bookings/deposit-claim] 예약 조회 실패", bookingError);
    return fail("예약을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.", 500);
  }
  if (!bookingData) return fail("예약을 찾을 수 없어요.", 404);

  const booking = bookingData as BookingRow;

  // 1) 로그인 본인 확인
  let authorized = false;
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  if (bearer) {
    const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data } = await authClient.auth.getUser(bearer);
    const user = data?.user;
    if (user) {
      if (booking.guest_id === user.id || booking.host_id === user.id) {
        authorized = true;
      } else if (user.email) {
        const { data: adminRow } = await admin
          .from("admins")
          .select("email")
          .ilike("email", user.email.toLowerCase())
          .maybeSingle();
        authorized = Boolean(adminRow);
      }
    }
  }

  // 2) 비로그인 예약 확인 토큰
  if (!authorized && guestToken && booking.access_token_hash) {
    authorized = sha256(guestToken) === booking.access_token_hash;
  }

  if (!authorized) {
    return fail("이 예약의 입금 신호를 보낼 권한이 없어요. 예약 확인 링크로 다시 들어와 주세요.", 403);
  }

  if (booking.status !== "pending") {
    return fail("이미 처리된 예약이에요. 예약 내역에서 상태를 확인해 주세요.", 409);
  }

  const { data: updated, error: updateError } = await admin
    .from("bookings")
    .update({
      paid_claimed_at: new Date().toISOString(),
      depositor_name: depositorName || booking.guest_name,
    })
    .eq("id", bookingId)
    .select("*")
    .single();

  if (updateError || !updated) {
    console.error("[api/bookings/deposit-claim] 저장 실패", updateError);
    return fail("입금 신호를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.", 500);
  }

  // 사장님이 큐에서 바로 알아볼 수 있도록 이력도 남긴다(실패해도 응답은 성공).
  await admin.from("booking_events").insert({
    booking_id: bookingId,
    event_type: "deposit_claimed",
    from_status: booking.status,
    to_status: booking.status,
    actor: "guest",
    memo: depositorName || booking.guest_name,
  });

  return NextResponse.json({ booking: updated as BookingRow });
}
