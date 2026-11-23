import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * 총괄 관리자 API 공통 확인.
 *
 * 클라이언트가 보낸 Bearer 토큰을 `auth.getUser` 로 검증하고,
 * `admins` 테이블에 등록된 이메일인지 service_role 로 다시 확인한다.
 * 통과하면 service_role 클라이언트를 돌려주고, 아니면 그대로 돌려줄 응답을 준다.
 */
export type AdminGuard = { client: SupabaseClient; email: string } | { response: NextResponse };

export function apiFail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function requireAdminClient(request: Request): Promise<AdminGuard> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    return { response: apiFail("지금은 처리할 수 없어요. 잠시 후 다시 시도해 주세요.", 503) };
  }

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return { response: apiFail("로그인이 필요해요.", 401) };

  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return { response: apiFail("로그인이 끝났어요. 다시 로그인해 주세요.", 401) };

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = (user.email ?? "").toLowerCase();
  const { data: adminRow } = email
    ? await admin.from("admins").select("email").ilike("email", email).maybeSingle()
    : { data: null };
  if (!adminRow) return { response: apiFail("총괄 관리자만 처리할 수 있어요.", 403) };

  return { client: admin, email };
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
