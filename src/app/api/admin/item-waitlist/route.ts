import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

/**
 * 총괄 관리자가 Item 사전 수요조사 한 건을 삭제한다.
 * 관리자 여부는 서버에서 admins 테이블로 다시 확인한다.
 */
export async function DELETE(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    return fail("지금은 삭제할 수 없어요. 잠시 후 다시 시도해 주세요.", 503);
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
  if (!adminRow) return fail("총괄 관리자만 삭제할 수 있어요.", 403);

  let body: { id?: string };
  try {
    body = (await request.json()) as { id?: string };
  } catch {
    return fail("요청을 읽지 못했어요.");
  }

  const id = (body.id ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return fail("삭제할 신청을 다시 확인해 주세요.");
  }

  const { error } = await admin.from("item_waitlist").delete().eq("id", id);
  if (error) {
    console.error("[api/admin/item-waitlist] 삭제 실패", error);
    return fail("수요조사를 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.", 500);
  }

  return NextResponse.json({ ok: true });
}
