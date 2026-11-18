import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { BookingRow } from "@/lib/mappers";
import { notifyHostOfBooking } from "@/lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BookingRequestBody {
  spaceId?: string;
  paySlug?: string;
  source?: string;
  date?: string;
  startTime?: string;
  hours?: number;
  guests?: number;
  guestName?: string;
  guestPhone?: string;
  memo?: string;
}

function badRequest(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

/** DB/RPC 오류 코드를 손님에게 보여줄 한국어 문구로 바꾼다. */
function toFriendlyError(raw: string): { status: number; error: string } {
  const message = raw ?? "";
  if (message.includes("SLOT_TAKEN")) {
    return {
      status: 409,
      error: "방금 다른 분이 같은 시간을 예약했어요. 다른 시간대나 날짜로 다시 신청해 주세요.",
    };
  }
  if (message.includes("PAST_TIME")) {
    return { status: 400, error: "지난 시간은 예약할 수 없어요. 날짜와 시작 시간을 다시 확인해 주세요." };
  }
  if (message.includes("OVER_CAPACITY")) {
    return { status: 400, error: "이 공간의 최대 인원을 넘었어요. 인원을 조정해 주세요." };
  }
  if (message.includes("SPACE_NOT_FOUND")) {
    return { status: 404, error: "공간을 찾을 수 없어요. 사장님께 링크를 다시 요청해 주세요." };
  }
  if (message.includes("INVALID_HOURS") || message.includes("INVALID_GUESTS") || message.includes("INVALID_GUEST")) {
    return { status: 400, error: "예약 정보를 다시 확인해 주세요." };
  }
  if (message.includes("INVALID_TIME") || message.includes("INVALID_DATE")) {
    return { status: 400, error: "날짜나 시작 시간이 올바르지 않아요. 다시 선택해 주세요." };
  }
  return { status: 500, error: "예약을 접수하지 못했어요. 잠시 후 다시 시도해 주세요." };
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceKey) {
    console.error("[api/bookings] Supabase 환경변수가 비어 있습니다.", {
      url: Boolean(url),
      anon: Boolean(anonKey),
      service: Boolean(serviceKey),
    });
    return badRequest("지금은 예약을 받을 수 없어요. 잠시 후 다시 시도해 주세요.", 503);
  }

  let body: BookingRequestBody;
  try {
    body = (await request.json()) as BookingRequestBody;
  } catch {
    return badRequest("예약 정보를 읽지 못했어요.");
  }

  const date = (body.date ?? "").trim();
  const startTime = (body.startTime ?? "").trim();
  const hours = Number(body.hours);
  const guests = Number(body.guests);
  const guestName = (body.guestName ?? "").trim();
  const guestPhone = (body.guestPhone ?? "").trim();
  const memo = (body.memo ?? "").trim().slice(0, 500);
  const source = body.source === "link" ? "link" : "web";
  const spaceId = (body.spaceId ?? "").trim();
  const paySlug = (body.paySlug ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest("이용 날짜를 다시 선택해 주세요.");
  if (!/^[0-2][0-9]:[0-5][0-9]$/.test(startTime)) return badRequest("시작 시간을 다시 선택해 주세요.");
  if (!Number.isInteger(hours) || hours < 1 || hours > 24) return badRequest("이용 시간은 1~24시간 사이로 선택해 주세요.");
  if (!Number.isInteger(guests) || guests < 1) return badRequest("인원을 1명 이상으로 선택해 주세요.");
  if (!guestName) return badRequest("예약자 이름을 입력해 주세요.");
  if (!guestPhone) return badRequest("연락처를 입력해 주세요.");
  if (source === "link" && !paySlug) return badRequest("예약 링크를 다시 확인해 주세요.");
  if (source !== "link" && !spaceId) return badRequest("공간 정보를 다시 확인해 주세요.");

  // 로그인 사용자라면 서버에서 직접 토큰을 검증한다(클라이언트가 보낸 guestId 는 신뢰하지 않는다).
  let guestId: string | null = null;
  const authorization = request.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    const token = authorization.slice(7).trim();
    if (token) {
      try {
        const authClient = createClient(url, anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data } = await authClient.auth.getUser(token);
        guestId = data.user?.id ?? null;
      } catch (error) {
        console.error("[api/bookings] 토큰 검증 실패", error);
        guestId = null;
      }
    }
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } =
    source === "link"
      ? await admin.rpc("create_booking_by_slug", {
          p_slug: paySlug,
          p_date: date,
          p_start_time: startTime,
          p_hours: hours,
          p_guests: guests,
          p_guest_name: guestName,
          p_guest_phone: guestPhone,
          p_memo: memo,
          p_guest_id: guestId,
        })
      : await admin.rpc("create_booking", {
          p_space: spaceId,
          p_date: date,
          p_start_time: startTime,
          p_hours: hours,
          p_guests: guests,
          p_guest_name: guestName,
          p_guest_phone: guestPhone,
          p_memo: memo,
          p_guest_id: guestId,
          p_source: "web",
        });

  if (error) {
    const friendly = toFriendlyError(`${error.message ?? ""} ${error.code ?? ""}`);
    if (friendly.status >= 500) {
      console.error("[api/bookings] 예약 생성 실패", error);
    }
    return NextResponse.json({ error: friendly.error }, { status: friendly.status });
  }

  if (!data) {
    console.error("[api/bookings] RPC 결과가 비어 있습니다.");
    return badRequest("예약을 접수하지 못했어요. 잠시 후 다시 시도해 주세요.", 500);
  }

  // 사장님 알림 메일 — 실패해도 예약 접수는 그대로 성공 처리한다.
  const booking = data as BookingRow;
  try {
    const mail = await notifyHostOfBooking("created", booking, { actor: "guest" });
    if (!mail.sent) console.warn("[api/bookings] 사장님 알림을 보내지 못했어요.", mail);
  } catch (mailError) {
    console.error("[api/bookings] 사장님 알림 예외", mailError);
  }

  return NextResponse.json({ booking }, { status: 201 });
}
