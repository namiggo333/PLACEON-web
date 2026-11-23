import { createClient } from "@supabase/supabase-js";
import { mapItemProduct, type ItemProductRow } from "./mappers";
import type { ItemProduct } from "./types";

/**
 * /item 페이지(서버)에서 보여 줄 판매 상품.
 * - anon 키 + RLS(`item_products_select_public`)로 숨김 상품은 애초에 내려오지 않는다.
 * - DB·네트워크 문제로 실패해도 페이지는 기존 수요조사 화면으로 뜨도록 빈 배열을 돌려준다.
 */
export async function fetchPublicItemProducts(): Promise<ItemProduct[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return [];

  try {
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client
      .from("item_products")
      .select("*")
      .neq("status", "hidden")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) {
      console.warn("[item] 상품 목록을 불러오지 못했어요.", error.message);
      return [];
    }
    return ((data ?? []) as ItemProductRow[]).map(mapItemProduct);
  } catch (error) {
    console.warn("[item] 상품 목록 조회 실패", error);
    return [];
  }
}
