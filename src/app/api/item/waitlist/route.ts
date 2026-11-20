import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { ITEM_CATEGORY_KEYS, ITEM_SPACE_TYPE_KEYS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface WaitlistRequestBody {
  categories?: unknown;
  customItem?: unknown;
  spaceType?: unknown;
  budgetOrQty?: unknown;
  contactType?: unknown;
  contact?: unknown;
  note?: unknown;
  wantsNotice?: unknown;
  source?: unknown;
}

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function text(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

/**
 * 이곳저곳 Item 사전 수요조사 접수.
 * - 손님 브라우저에서는 직접 INSERT 할 수 없고(RLS·권한 회수), 이 라우트가 service_role 로 저장한다.
 * - 같은 연락처로 2분 안에 다시 들어온 요청은 중복 접수로 보고 새 행을 만들지 않는다.
 */
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("[api/item/waitlist] Supabase 환경변수가 비어 있습니다.");
    return fail("지금은 신청을 받을 수 없어요. 잠시 후 다시 시도해 주세요.", 503);
  }

  let body: WaitlistRequestBody;
  try {
    body = (await request.json()) as WaitlistRequestBody;
  } catch {
    return fail("신청 내용을 읽지 못했어요. 다시 시도해 주세요.");
  }

  const rawCategories = Array.isArray(body.categories) ? body.categories : [];
  const categories = Array.from(
    new Set(
      rawCategories.filter(
        (value): value is string => typeof value === "string" && ITEM_CATEGORY_KEYS.includes(value)
      )
    )
  ).slice(0, ITEM_CATEGORY_KEYS.length);

  const customItem = text(body.customItem, 300);
  const spaceTypeRaw = text(body.spaceType, 40);
  const spaceType = ITEM_SPACE_TYPE_KEYS.includes(spaceTypeRaw) ? spaceTypeRaw : "";
  const budgetOrQty = text(body.budgetOrQty, 100);
  const note = text(body.note, 1000);
  const wantsNotice = body.wantsNotice !== false;
  const source = body.source === "host" ? "host" : "item";

  if (categories.length === 0 && !customItem) {
    return fail("필요한 비품·가전 카테고리를 하나 이상 골라 주세요.");
  }
  if (!spaceType) {
    return fail("운영 중이거나 준비 중인 공간 유형을 골라 주세요.");
  }

  const contactType = body.contactType === "email" ? "email" : "phone";
  const rawContact = text(body.contact, 120);
  let contact = rawContact;

  if (contactType === "phone") {
    const digits = rawContact.replace(/[^\d]/g, "").replace(/^82(?=0\d{8,10}$)/, "0");
    if (!/^0\d{8,10}$/.test(digits)) {
      return fail("휴대폰 번호를 다시 확인해 주세요. (예: 010-1234-5678)");
    }
    contact = digits;
  } else {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(rawContact) || rawContact.length > 120) {
      return fail("이메일 주소를 다시 확인해 주세요.");
    }
    contact = rawContact.toLowerCase();
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 더블 클릭·뒤로가기 재전송으로 같은 신청이 두 번 쌓이지 않게 최근 2분 중복을 확인한다.
  const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: recent, error: recentError } = await admin
    .from("item_waitlist")
    .select("id")
    .eq("contact", contact)
    .gte("created_at", since)
    .limit(1);

  if (recentError) {
    console.error("[api/item/waitlist] 중복 확인 실패", recentError);
  } else if ((recent ?? []).length > 0) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const { data, error } = await admin
    .from("item_waitlist")
    .insert({
      categories,
      custom_item: customItem,
      space_type: spaceType,
      budget_or_qty: budgetOrQty,
      contact_type: contactType,
      contact,
      note,
      wants_notice: wantsNotice,
      source,
    })
    .select("id, created_at")
    .single();

  if (error) {
    console.error("[api/item/waitlist] 저장 실패", error);
    return fail("신청을 접수하지 못했어요. 잠시 후 다시 시도해 주세요.", 500);
  }

  return NextResponse.json({ ok: true, id: data?.id ?? null, createdAt: data?.created_at ?? null }, { status: 201 });
}
