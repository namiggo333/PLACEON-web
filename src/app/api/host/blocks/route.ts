import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BlockRequestBody {
  action?: "create" | "release";
  spaceId?: string;
  bookingId?: string;
  date?: string;
  startTime?: string;
  hours?: number;
  memo?: string;
}

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

/**
 * 사장님 시간 차단/해제.
 * 차단 행은 bookings 에 source='block' 으로 저장되어 같은 공간의 중복 예약을 원천 차단한다.
 */
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    return fail("지금은 시간 관리를 할 수 없어요. 잠시 후 다시 시도해 주세요.", 503);
  }

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return fail("로그인이 필요해요. 다시 로그인해 주세요.", 401);

  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return fail("로그인이 끝났어요. 다시 로그인해 주세요.", 401);

  let body: BlockRequestBody;
  try {
    body = (await request.json()) as BlockRequestBody;
  } catch {
    return fail("요청을 읽지 못했어요.");
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const action = body.action ?? "create";

  if (action === "create") {
    const spaceId = (body.spaceId ?? "").trim();
    const date = (body.date ?? "").trim();
    const startTime = (body.startTime ?? "").trim();
    const hours = Number(body.hours);
    const memo = (body.memo ?? "").trim().slice(0, 200);

    if (!spaceId) return fail("공간을 선택해 주세요.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("차단할 날짜를 선택해 주세요.");
    if (!/^[0-2][0-9]:[0-5][0-9]$/.test(startTime)) return fail("차단할 시작 시간을 선택해 주세요.");
    if (!Number.isInteger(hours) || hours < 1 || hours > 24) return fail("차단 시간은 1~24시간 사이로 선택해 주세요.");

    const { data: space, error: spaceError } = await admin
      .from("spaces")
      .select("id, host_id")
      .eq("id", spaceId)
      .maybeSingle();
    if (spaceError) {
      console.error("[api/host/blocks] 공간 조회 실패", spaceError);
      return fail("공간을 확인하지 못했어요.", 500);
    }
    if (!space) return fail("공간을 찾을 수 없어요.", 404);
    if (space.host_id !== user.id) return fail("내 공간만 시간을 차단할 수 있어요.", 403);

    const { data, error } = await admin.rpc("create_space_block", {
      p_space: spaceId,
      p_date: date,
      p_start_time: startTime,
      p_hours: hours,
      p_memo: memo,
      p_actor_id: user.id,
    });

    if (error) {
      const message = `${error.message ?? ""}`;
      if (message.includes("SLOT_TAKEN")) {
        return fail("그 시간대에 이미 예약이나 차단이 있어요. 다른 시간을 선택해 주세요.", 409);
      }
      if (message.includes("PAST_TIME")) {
        return fail("지난 시간은 차단할 수 없어요.", 400);
      }
      console.error("[api/host/blocks] 차단 실패", error);
      return fail("시간을 차단하지 못했어요. 잠시 후 다시 시도해 주세요.", 500);
    }

    return NextResponse.json({ booking: data }, { status: 201 });
  }

  if (action === "release") {
    const bookingId = (body.bookingId ?? "").trim();
    if (!bookingId) return fail("해제할 차단을 선택해 주세요.");

    const { data: block, error: blockError } = await admin
      .from("bookings")
      .select("id, host_id, source, status")
      .eq("id", bookingId)
      .maybeSingle();
    if (blockError) {
      console.error("[api/host/blocks] 차단 조회 실패", blockError);
      return fail("차단 정보를 확인하지 못했어요.", 500);
    }
    if (!block) return fail("차단을 찾을 수 없어요.", 404);
    if (block.host_id !== user.id) return fail("내 공간의 차단만 해제할 수 있어요.", 403);
    if (block.source !== "block") return fail("사장님 시간 차단만 해제할 수 있어요.", 400);

    const { data, error } = await admin.rpc("release_space_block", {
      p_booking_id: bookingId,
      p_actor_id: user.id,
    });
    if (error) {
      console.error("[api/host/blocks] 차단 해제 실패", error);
      return fail("차단을 해제하지 못했어요. 잠시 후 다시 시도해 주세요.", 500);
    }
    return NextResponse.json({ booking: data });
  }

  return fail("알 수 없는 요청이에요.");
}
