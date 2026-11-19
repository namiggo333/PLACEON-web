import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { BookingRow } from "@/lib/mappers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AccessRequestBody {
  bookingId?: string;
  token?: string;
}

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * 확정된 예약의 상세주소·출입 안내를 돌려준다.
 *
 * - 로그인 본인(예약자·사장님·관리자)이거나
 * - 예약 접수 때 발급된 access_token(DB 에는 해시만 저장)이 일치해야 하며,
 * - 예약 상태가 confirmed 인 경우에만 상세 정보를 내려준다.
 */
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    return fail("지금은 예약 정보를 확인할 수 없어요. 잠시 후 다시 시도해 주세요.", 503);
  }

  let body: AccessRequestBody;
  try {
    body = (await request.json()) as AccessRequestBody;
  } catch {
    return fail("요청을 읽지 못했어요.");
  }

  const bookingId = (body.bookingId ?? "").trim();
  const guestToken = (body.token ?? "").trim();
  if (!bookingId) return fail("예약 정보를 다시 확인해 주세요.");

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: bookingData, error: bookingError } = await admin
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();
  if (bookingError) {
    console.error("[api/bookings/access] 예약 조회 실패", bookingError);
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
    return fail("예약 확인 권한이 없어요. 예약 완료 때 받은 확인 링크로 다시 열어 주세요.", 403);
  }

  const { data: privateData, error: privateError } = booking.status === "confirmed"
    ? await admin.from("spaces_private").select("*").eq("space_id", booking.space_id).maybeSingle()
    : { data: null, error: null };
  if (privateError) {
    console.error("[api/bookings/access] 상세 정보 조회 실패", privateError);
    return fail("상세 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.", 500);
  }

  const { data: spaceData } = await admin
    .from("spaces")
    .select("name, region, district")
    .eq("id", booking.space_id)
    .maybeSingle();

  return NextResponse.json({
    access:
      booking.status === "confirmed"
        ? {
            detailAddress: privateData?.detail_address ?? "",
            entryGuide: privateData?.entry_guide ?? "",
            parkingGuide: privateData?.parking_guide ?? "",
          }
        : null,
    message:
      booking.status === "confirmed"
        ? ""
        : booking.status === "cancelled"
          ? "취소된 예약이에요. 상세주소는 확인할 수 없어요."
          : "입금이 확인되어 예약이 확정된 뒤에 상세주소와 출입 안내를 확인할 수 있어요.",
    space: {
      name: spaceData?.name ?? booking.space_name,
      area: [spaceData?.region ?? "", spaceData?.district ?? ""].filter(Boolean).join(" "),
    },
    booking: {
      id: booking.id,
      date: booking.date,
      startTime: booking.start_time,
      hours: booking.hours,
      status: booking.status,
      refundStatus: booking.refund_status ?? "none",
      guestName: booking.guest_name,
      totalAmount: booking.total_amount,
    },
  });
}
