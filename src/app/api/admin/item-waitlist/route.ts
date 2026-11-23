import { NextResponse } from "next/server";
import { apiFail, isUuid, requireAdminClient } from "@/lib/server-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WAITLIST_STATUSES = ["new", "contacted", "done"] as const;

/**
 * 총괄 관리자의 Item 수요조사·문의 처리.
 * - DELETE: 한 건 삭제
 * - PATCH : 처리 상태(접수/연락완료/처리완료)·관리자 메모 저장
 * 관리자 여부는 서버에서 admins 테이블로 다시 확인한다.
 */
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
  if (!isUuid(id)) return apiFail("삭제할 신청을 다시 확인해 주세요.");

  const { error } = await guard.client.from("item_waitlist").delete().eq("id", id);
  if (error) {
    console.error("[api/admin/item-waitlist] 삭제 실패", error);
    return apiFail("수요조사를 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.", 500);
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const guard = await requireAdminClient(request);
  if ("response" in guard) return guard.response;

  let body: { id?: string; status?: string; adminMemo?: string };
  try {
    body = (await request.json()) as { id?: string; status?: string; adminMemo?: string };
  } catch {
    return apiFail("요청을 읽지 못했어요.");
  }

  const id = (body.id ?? "").trim();
  if (!isUuid(id)) return apiFail("수정할 신청을 다시 확인해 주세요.");

  const patch: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!WAITLIST_STATUSES.includes(body.status as (typeof WAITLIST_STATUSES)[number])) {
      return apiFail("처리 상태를 다시 골라 주세요.");
    }
    patch.status = body.status;
  }
  if (body.adminMemo !== undefined) {
    if (typeof body.adminMemo !== "string") return apiFail("메모를 다시 확인해 주세요.");
    const memo = body.adminMemo.trim();
    if (memo.length > 2000) return apiFail("메모는 2000자까지 저장할 수 있어요.");
    patch.admin_memo = memo;
  }
  if (Object.keys(patch).length === 0) return apiFail("바꿀 내용이 없어요.");

  const { data, error } = await guard.client
    .from("item_waitlist")
    .update(patch)
    .eq("id", id)
    .select("id, status, admin_memo")
    .maybeSingle();

  if (error) {
    console.error("[api/admin/item-waitlist] 수정 실패", error);
    return apiFail("수요조사를 수정하지 못했어요. 잠시 후 다시 시도해 주세요.", 500);
  }
  if (!data) return apiFail("수요조사를 찾지 못했어요.", 404);

  return NextResponse.json({ entry: data });
}
