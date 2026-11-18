import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 사장님이 공간을 등록·수정·삭제했을 때 홈(ISR) 캐시를 즉시 비운다.
 * 같은 사이트에서 온 요청만 처리한다.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return NextResponse.json({ revalidated: false, error: "허용되지 않은 요청이에요." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ revalidated: false, error: "잘못된 요청이에요." }, { status: 400 });
    }
  }

  revalidatePath("/");
  revalidatePath("/search");

  return NextResponse.json({ revalidated: true, at: new Date().toISOString() });
}
