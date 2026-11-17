/**
 * 이곳저곳 총괄 관리자(/admin) 접근 권한
 *
 * - 관리자는 이 목록의 이메일로 로그인한 계정만 인식합니다.
 * - 화면 접근 제한은 편의를 위한 1차 확인이고, 실제 데이터 접근은
 *   Supabase RLS(`public.is_admin()`)가 서버에서 다시 막습니다.
 *   (supabase/schema.sql 의 "6. 총괄 관리자" 참고)
 */
export const ADMIN_EMAILS = ["namiggo333@gmail.com"] as const;

export const ADMIN_PRIMARY_EMAIL = ADMIN_EMAILS[0];

export function isAdminEmail(email?: string | null): boolean {
  const normalized = (email ?? "").trim().toLowerCase();
  if (!normalized) return false;
  return ADMIN_EMAILS.some((admin) => admin === normalized);
}
