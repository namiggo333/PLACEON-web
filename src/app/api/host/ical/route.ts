import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface IcsBody {
  action?: "fetch";
  url?: string;
}

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

/**
 * 사장님 캘린더 연동 보조 API.
 *
 * - GET  : 내 공간별 iCal 구독 주소(토큰)를 돌려준다. 토큰이 없으면 만들어 준다.
 *          토큰은 space_ical_tokens 에만 있고, 공개 공간 조회로는 노출되지 않는다.
 * - POST : 외부 .ics 주소를 서버에서 대신 받아 온다(브라우저 CORS 회피).
 *          { action: "fetch", url }
 */
export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) return fail("지금은 캘린더를 연결할 수 없어요.", 503);

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return fail("로그인이 필요해요. 다시 로그인해 주세요.", 401);

  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return fail("로그인이 끝났어요. 다시 로그인해 주세요.", 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: spaces, error: spaceError } = await admin
    .from("spaces")
    .select("id, name, pay_slug")
    .eq("host_id", user.id)
    .order("created_at", { ascending: true });

  if (spaceError) {
    console.error("[api/host/ical] 공간 조회 실패", spaceError);
    return fail("공간 정보를 불러오지 못했어요.", 500);
  }

  const ids = (spaces ?? []).map((space) => space.id as string);
  let tokenRows: { space_id: string; token: string }[] = [];
  if (ids.length > 0) {
    const { data } = await admin.from("space_ical_tokens").select("space_id, token").in("space_id", ids);
    tokenRows = (data ?? []) as { space_id: string; token: string }[];
  }

  const existing = new Map(tokenRows.map((row) => [row.space_id, row.token]));
  const missing = ids.filter((id) => !existing.has(id));

  if (missing.length > 0) {
    const { data: inserted, error: insertError } = await admin
      .from("space_ical_tokens")
      .insert(missing.map((spaceId) => ({ space_id: spaceId })))
      .select("space_id, token");
    if (insertError) {
      console.error("[api/host/ical] 구독 토큰 생성 실패", insertError);
      return fail("구독 주소를 만들지 못했어요. 잠시 후 다시 시도해 주세요.", 500);
    }
    for (const row of (inserted ?? []) as { space_id: string; token: string }[]) {
      existing.set(row.space_id, row.token);
    }
  }

  const origin = new URL(request.url).origin;
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? origin).replace(/\/$/, "");

  return NextResponse.json({
    spaces: (spaces ?? []).map((space) => {
      const spaceToken = existing.get(space.id as string) ?? "";
      return {
        id: space.id,
        name: space.name,
        token: spaceToken,
        url: spaceToken ? `${site}/api/spaces/${space.id}/ical?token=${spaceToken}` : "",
      };
    }),
  });
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return fail("지금은 캘린더를 연결할 수 없어요.", 503);

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return fail("로그인이 필요해요. 다시 로그인해 주세요.", 401);

  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData?.user) return fail("로그인이 끝났어요. 다시 로그인해 주세요.", 401);

  let body: IcsBody;
  try {
    body = (await request.json()) as IcsBody;
  } catch {
    return fail("요청을 읽지 못했어요.");
  }

  const target = (body.url ?? "").trim();
  if (!/^https?:\/\//i.test(target)) return fail("http(s) 주소만 가져올 수 있어요.");

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return fail("주소 형식을 확인해 주세요.");
  }
  // 사설망 주소로 서버가 대신 요청하지 않도록 막는다(SSRF 방지).
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    /^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "[::1]"
  ) {
    return fail("이 주소에서는 가져올 수 없어요.");
  }

  try {
    const response = await fetch(parsed.toString(), {
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
      headers: { Accept: "text/calendar, text/plain, */*" },
    });
    if (!response.ok) return fail(`캘린더를 가져오지 못했어요. (HTTP ${response.status})`, 400);
    const text = (await response.text()).slice(0, 1_500_000);
    if (!/BEGIN:VCALENDAR/i.test(text)) {
      return fail("받은 내용이 iCalendar(.ics) 형식이 아니에요. 공개 캘린더 주소인지 확인해 주세요.", 400);
    }
    return NextResponse.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/host/ical] 가져오기 실패", message);
    return fail("캘린더를 가져오지 못했어요. 주소가 공개되어 있는지 확인해 주세요.", 400);
  }
}
