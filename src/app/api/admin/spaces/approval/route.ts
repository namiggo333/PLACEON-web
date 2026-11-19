import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ApprovalRequestBody {
  spaceId?: string;
  status?: string;
  reason?: string;
}

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

/**
 * 총괄 관리자의 공간 승인/반려.
 * 관리자 여부는 서버에서 admins 테이블로 다시 확인한다.
 */
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    return fail("지금은 승인 처리를 할 수 없어요. 잠시 후 다시 시도해 주세요.", 503);
  }

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return fail("로그인이 필요해요.", 401);

  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return fail("로그인이 끝났어요. 다시 로그인해 주세요.", 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const email = (user.email ?? "").toLowerCase();
  const { data: adminRow } = email
    ? await admin.from("admins").select("email").ilike("email", email).maybeSingle()
    : { data: null };
  if (!adminRow) return fail("총괄 관리자만 승인할 수 있어요.", 403);

  let body: ApprovalRequestBody;
  try {
    body = (await request.json()) as ApprovalRequestBody;
  } catch {
    return fail("요청을 읽지 못했어요.");
  }

  const spaceId = (body.spaceId ?? "").trim();
  const status = (body.status ?? "").trim();
  const reason = (body.reason ?? "").trim().slice(0, 300);

  if (!spaceId) return fail("공간을 선택해 주세요.");
  if (status !== "approved" && status !== "rejected" && status !== "pending_review") {
    return fail("승인 상태를 다시 확인해 주세요.");
  }
  if (status === "rejected" && !reason) return fail("반려 사유를 입력해 주세요.");

  const { data, error } = await admin.rpc("set_space_approval", {
    p_space_id: spaceId,
    p_status: status,
    p_reason: reason,
    p_actor: "admin",
    p_actor_id: user.id,
  });

  if (error) {
    console.error("[api/admin/spaces/approval] 승인 처리 실패", error);
    return fail("승인 상태를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.", 500);
  }

  return NextResponse.json({ space: data });
}
