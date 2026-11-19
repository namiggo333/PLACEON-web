import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { BookingRow } from "@/lib/mappers";
import { notifyHostOfBooking } from "@/lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StatusRequestBody {
  bookingId?: string;
  status?: string;
  reason?: string | null;
  refundStatus?: string | null;
  memo?: string | null;
}

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    console.error("[api/bookings/status] Supabase 환경변수가 비어 있습니다.");
    return fail("지금은 예약 상태를 바꿀 수 없어요. 잠시 후 다시 시도해 주세요.", 503);
  }

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return fail("로그인이 필요해요. 다시 로그인해 주세요.", 401);

  let body: StatusRequestBody;
  try {
    body = (await request.json()) as StatusRequestBody;
  } catch {
    return fail("요청을 읽지 못했어요.");
  }

  const bookingId = (body.bookingId ?? "").trim();
  const status = (body.status ?? "").trim();
  const refundStatus = (body.refundStatus ?? "").trim();
  const memo = (body.memo ?? "").trim().slice(0, 500);
  if (!bookingId) return fail("예약 정보를 다시 확인해 주세요.");
  if (status && status !== "pending" && status !== "confirmed" && status !== "cancelled") {
    return fail("예약 상태를 다시 확인해 주세요.");
  }
  if (refundStatus && refundStatus !== "none" && refundStatus !== "pending" && refundStatus !== "completed") {
    return fail("환불 상태를 다시 확인해 주세요.");
  }
  if (!status && !refundStatus) return fail("변경할 내용이 없어요.");

  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return fail("로그인이 끝났어요. 다시 로그인해 주세요.", 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: bookingData, error: bookingError } = await admin
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();
  if (bookingError) {
    console.error("[api/bookings/status] 예약 조회 실패", bookingError);
    return fail("예약을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.", 500);
  }
  if (!bookingData) return fail("예약을 찾을 수 없어요.", 404);

  const booking = bookingData as BookingRow;

  // 권한: 사장님(내 공간 예약) · 손님(내 예약 취소만) · 총괄 관리자
  const isHost = booking.host_id === user.id;
  const isGuest = booking.guest_id !== null && booking.guest_id === user.id;
  let isAdmin = false;
  const email = (user.email ?? "").toLowerCase();
  if (email) {
    const { data: adminRow } = await admin.from("admins").select("email").ilike("email", email).maybeSingle();
    isAdmin = Boolean(adminRow);
  }

  if (!isHost && !isGuest && !isAdmin) return fail("이 예약을 변경할 권한이 없어요.", 403);
  if (booking.source === "block") {
    return fail("사장님 시간 차단은 공간 관리의 ‘시간 차단’에서 해제해 주세요.", 400);
  }
  if (isGuest && !isHost && !isAdmin && status !== "cancelled") {
    return fail("손님은 예약을 취소만 할 수 있어요.", 403);
  }
  if (refundStatus && isGuest && !isHost && !isAdmin) {
    return fail("환불 처리는 사장님만 할 수 있어요.", 403);
  }
  if (refundStatus && booking.status !== "cancelled") {
    return fail("취소된 예약만 환불 상태를 바꿀 수 있어요.", 400);
  }

  const actor = isAdmin ? "admin" : isGuest && !isHost ? "guest" : "host";
  const previousStatus = booking.status;
  let updated = booking;

  if (status && status !== booking.status) {
    const reason = status === "cancelled" ? (body.reason === "guest" || actor === "guest" ? "guest" : "host") : null;
    const { data: changed, error: changeError } = await admin.rpc("set_booking_status", {
      p_booking_id: bookingId,
      p_status: status,
      p_reason: reason,
      p_actor: actor,
      p_actor_id: user.id,
    });
    if (changeError) {
      console.error("[api/bookings/status] 예약 상태 변경 실패", changeError);
      return fail("예약 상태를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.", 500);
    }
    updated = changed as BookingRow;
  }

  if (refundStatus && refundStatus !== (updated.refund_status ?? "none")) {
    const { data: changed, error: refundError } = await admin.rpc("set_refund_status", {
      p_booking_id: bookingId,
      p_refund_status: refundStatus,
      p_actor: actor,
      p_actor_id: user.id,
      p_memo: memo,
    });
    if (refundError) {
      console.error("[api/bookings/status] 환불 상태 변경 실패", refundError);
      return fail("환불 상태를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.", 500);
    }
    updated = changed as BookingRow;
  }

  const updatedBooking = updated as BookingRow;

  // 사장님이 직접 누른 것은 메일로 되돌리지 않는다. 손님·관리자의 변경만 사장님께 알린다.
  const notifyKind =
    status === "confirmed" ? "confirmed" : status === "cancelled" ? "cancelled" : null;
  const shouldNotify = Boolean(notifyKind) && !isHost && previousStatus !== updatedBooking.status;
  if (notifyKind && shouldNotify) {
    try {
      const mail = await notifyHostOfBooking(notifyKind, updatedBooking, {
        actor: isAdmin ? "admin" : isGuest ? "guest" : "host",
      });
      if (!mail.sent) console.warn("[api/bookings/status] 사장님 알림을 보내지 못했어요.", mail);
    } catch (mailError) {
      console.error("[api/bookings/status] 사장님 알림 예외", mailError);
    }
  }

  return NextResponse.json({ booking: updatedBooking });
}
