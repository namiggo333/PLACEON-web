import { createClient } from "@supabase/supabase-js";
import { mapSpace, type SpaceRow } from "./mappers";
import type { Space } from "./types";

/**
 * 서버 컴포넌트(SSR/ISR)에서 공간 목록을 직접 조회한다.
 * - anon 키 + RLS(spaces_select_all)만 사용하므로 공개 데이터 외에는 볼 수 없다.
 * - 조회 실패 시 빈 배열을 돌려주고, 클라이언트 쪽 데이터 로딩이 이어받는다.
 */
export async function fetchPublicSpaces(): Promise<Space[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return [];

  try {
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "X-Client-Info": "igotjeogot-home-ssr" } },
    });

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
