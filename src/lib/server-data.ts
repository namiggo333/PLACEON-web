import { createClient } from "@supabase/supabase-js";
import { mapSpace, type SpaceRow } from "./mappers";
import type { Space } from "./types";

/**
 * 서버 컴포넌트(SSR/ISR)·OG 이미지에서 공간 정보를 직접 조회한다.
 * - anon 키 + RLS(spaces_select_visible)만 사용하므로 공개(승인·비공개 아님) 데이터만 볼 수 있다.
 * - 조회 실패 시 null/빈 배열을 돌려주고, 클라이언트 쪽 데이터 로딩이 이어받는다.
 */
function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "X-Client-Info": "igotjeogot-ssr" } },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function fetchPublicSpaces(): Promise<Space[]> {
  const client = publicClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from("spaces")
      .select("*")
      .eq("is_hidden", false)
      .eq("approval_status", "approved")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return ((data ?? []) as SpaceRow[]).map(mapSpace);
  } catch (error) {
    console.error("[server-data] 공간 목록을 불러오지 못했습니다.", error);
    return [];
  }
}

/** 승인·공개된 공간 하나 (없거나 비공개·미승인이면 null) */
export async function fetchPublicSpaceById(id: string): Promise<Space | null> {
  if (!id || !UUID_RE.test(id)) return null;
  const client = publicClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from("spaces")
      .select("*")
      .eq("id", id)
      .eq("is_hidden", false)
      .eq("approval_status", "approved")
      .maybeSingle();
    if (error) throw error;
    return data ? mapSpace(data as SpaceRow) : null;
  } catch (error) {
    console.error("[server-data] 공간을 불러오지 못했습니다.", error);
    return null;
  }
}

/** 전용 결제 링크 슬러그로 승인·공개 공간 조회 */
export async function fetchPublicSpaceBySlug(slug: string): Promise<Space | null> {
  const clean = (slug ?? "").trim();
  if (!clean || clean.length > 64) return null;
  const client = publicClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from("spaces")
      .select("*")
      .eq("pay_slug", clean)
      .eq("is_hidden", false)
      .eq("approval_status", "approved")
      .maybeSingle();
    if (error) throw error;
    return data ? mapSpace(data as SpaceRow) : null;
  } catch (error) {
    console.error("[server-data] 결제 링크 공간을 불러오지 못했습니다.", error);
    return null;
  }
}
