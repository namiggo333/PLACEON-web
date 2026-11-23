import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ITEM_CATEGORY_KEYS } from "@/lib/constants";
import { apiFail, isUuid, requireAdminClient } from "@/lib/server-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = ["active", "restocking", "soldout", "hidden"] as const;
type Status = (typeof STATUSES)[number];

function text(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function toInt(value: unknown, min: number, max: number): number | null {
  const num = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(num)) return null;
  const rounded = Math.round(num);
  if (rounded < min || rounded > max) return null;
  return rounded;
}

function imageUrl(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const url = value.trim();
  if (!url) return null;
  if (url.length > 500) return undefined;
  if (url.startsWith("/")) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return undefined;
}

/**
 * 총괄 관리자 Item 상품·재고 API.
 * - GET   : 전체 상품(숨김 포함) 목록
 * - POST  : 새 상품 등록
 * - PATCH : 상품 정보·재고(+/- 또는 절대값)·판매 상태 수정
 * - DELETE: 상품 삭제
 * 관리자 권한은 서버에서 admins 테이블로 확인한다(service_role 사용).
 */
export async function GET(request: Request) {
  const guard = await requireAdminClient(request);
  if ("response" in guard) return guard.response;

  const { data, error } = await guard.client
    .from("item_products")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[api/admin/items] 목록 실패", error);
    return apiFail("상품 목록을 불러오지 못했어요.", 500);
  }
  return NextResponse.json({ products: data ?? [] });
}

export async function POST(request: Request) {
  const guard = await requireAdminClient(request);
  if ("response" in guard) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiFail("요청을 읽지 못했어요.");
  }

  const name = text(body.name, 80);
  if (!name) return apiFail("상품명을 입력해 주세요.");

  const category = text(body.category, 20);
  if (!ITEM_CATEGORY_KEYS.includes(category)) return apiFail("카테고리를 다시 골라 주세요.");

  const price = toInt(body.price, 0, 100000000);
  if (price === null) return apiFail("가격을 0원 이상 숫자로 입력해 주세요.");

  const stock = toInt(body.stock, 0, 1000000);
  if (stock === null) return apiFail("재고 수량을 0 이상 숫자로 입력해 주세요.");

  const statusRaw = body.status === undefined ? "active" : text(body.status, 20);
  if (!STATUSES.includes(statusRaw as Status)) return apiFail("판매 상태를 다시 골라 주세요.");
  let status = statusRaw as Status;
  // 재고 0으로 등록하면 품절로 시작한다(숨김은 그대로).
  if (status === "active" && stock === 0) status = "soldout";

  const image = imageUrl(body.imageUrl);
  if (body.imageUrl !== undefined && image === undefined) {
    return apiFail("이미지 주소는 https:// 로 시작하는 URL 또는 / 로 시작하는 경로만 넣을 수 있어요.");
  }

  const sortOrder = body.sortOrder === undefined ? 0 : toInt(body.sortOrder, -100000, 100000);
  if (sortOrder === null) return apiFail("정렬 순서를 숫자로 입력해 주세요.");

  const payload = {
    name,
    category,
    description: text(body.description, 500),
    price,
    unit: text(body.unit, 40) || "1개",
    stock,
    status,
    image_url: image ?? null,
    sort_order: sortOrder,
  };

  const { data, error } = await guard.client.from("item_products").insert(payload).select("*").single();
  if (error) {
    console.error("[api/admin/items] 등록 실패", error);
    return apiFail("상품을 등록하지 못했어요. 잠시 후 다시 시도해 주세요.", 500);
  }
  revalidatePath("/item");
  return NextResponse.json({ product: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const guard = await requireAdminClient(request);
  if ("response" in guard) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiFail("요청을 읽지 못했어요.");
  }

  const id = text(body.id, 40);
  if (!isUuid(id)) return apiFail("수정할 상품을 다시 확인해 주세요.");

  const { data: current, error: findError } = await guard.client
    .from("item_products")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (findError) {
    console.error("[api/admin/items] 조회 실패", findError);
    return apiFail("상품을 불러오지 못했어요.", 500);
  }
  if (!current) return apiFail("상품을 찾지 못했어요.", 404);

  const patch: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = text(body.name, 80);
    if (!name) return apiFail("상품명을 입력해 주세요.");
    patch.name = name;
  }
  if (body.category !== undefined) {
    const category = text(body.category, 20);
    if (!ITEM_CATEGORY_KEYS.includes(category)) return apiFail("카테고리를 다시 골라 주세요.");
    patch.category = category;
  }
  if (body.description !== undefined) patch.description = text(body.description, 500);
  if (body.unit !== undefined) patch.unit = text(body.unit, 40) || "1개";
  if (body.imageUrl !== undefined) {
    const image = imageUrl(body.imageUrl);
    if (image === undefined) {
      return apiFail("이미지 주소는 https:// 로 시작하는 URL 또는 / 로 시작하는 경로만 넣을 수 있어요.");
    }
    patch.image_url = image;
  }
  if (body.price !== undefined) {
    const price = toInt(body.price, 0, 100000000);
    if (price === null) return apiFail("가격을 0원 이상 숫자로 입력해 주세요.");
    patch.price = price;
  }
  if (body.sortOrder !== undefined) {
    const sortOrder = toInt(body.sortOrder, -100000, 100000);
    if (sortOrder === null) return apiFail("정렬 순서를 숫자로 입력해 주세요.");
    patch.sort_order = sortOrder;
  }

  // 재고: 절대값(stock) 또는 증감(stockDelta) 중 하나.
  let nextStock: number | null = null;
  if (body.stockDelta !== undefined) {
    const delta = toInt(body.stockDelta, -1000000, 1000000);
    if (delta === null) return apiFail("재고 변경 수량을 다시 확인해 주세요.");
    nextStock = Math.max(0, Math.min(1000000, Number(current.stock ?? 0) + delta));
  } else if (body.stock !== undefined) {
    const stock = toInt(body.stock, 0, 1000000);
    if (stock === null) return apiFail("재고 수량을 0 이상 숫자로 입력해 주세요.");
    nextStock = stock;
  }
  if (nextStock !== null) patch.stock = nextStock;

  if (body.status !== undefined) {
    const status = text(body.status, 20);
    if (!STATUSES.includes(status as Status)) return apiFail("판매 상태를 다시 골라 주세요.");
    patch.status = status;
  } else if (nextStock !== null && body.stockDelta !== undefined) {
    // 재고 증감만 했을 때: 0이 되면 품절, 다시 채워지면 판매중으로 되돌린다.
    const currentStatus = String(current.status ?? "active");
    if (nextStock === 0 && currentStatus === "active") patch.status = "soldout";
    if (nextStock > 0 && currentStatus === "soldout") patch.status = "active";
  }

  if (Object.keys(patch).length === 0) return apiFail("바꿀 내용이 없어요.");

  const { data, error } = await guard.client.from("item_products").update(patch).eq("id", id).select("*").single();
  if (error) {
    console.error("[api/admin/items] 수정 실패", error);
    return apiFail("상품을 수정하지 못했어요. 잠시 후 다시 시도해 주세요.", 500);
  }
  revalidatePath("/item");
  return NextResponse.json({ product: data });
}

export async function DELETE(request: Request) {
  const guard = await requireAdminClient(request);
  if ("response" in guard) return guard.response;

  let body: { id?: string };
  try {
    body = (await request.json()) as { id?: string };
  } catch {
    return apiFail("요청을 읽지 못했어요.");
  }

  const id = (body.id ?? "").trim();
  if (!isUuid(id)) return apiFail("삭제할 상품을 다시 확인해 주세요.");

  const { error } = await guard.client.from("item_products").delete().eq("id", id);
  if (error) {
    console.error("[api/admin/items] 삭제 실패", error);
    return apiFail("상품을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.", 500);
  }
  revalidatePath("/item");
  return NextResponse.json({ ok: true });
}
