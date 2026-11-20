-- ============================================================
-- 006_item_waitlist.sql
-- 이곳저곳 Item — 오픈 예고 + 사전 수요조사 접수
--
--  1) item_waitlist
--     - 아직 판매 전인 '이곳저곳 Item'(리퍼·비품 특가 몰)의 사전 수요조사 신청.
--     - 신청은 서버 API(/api/item/waitlist, service_role)만 받는다.
--       anon/authenticated 에 insert 권한을 주지 않아 검증 없이 직접 넣을 수 없다.
--     - 조회·삭제는 총괄 관리자(public.is_admin())만 가능하다.
--  2) idempotent — 여러 번 실행해도 안전하다.
-- ============================================================

create table if not exists public.item_waitlist (
  id            uuid primary key default gen_random_uuid(),
  -- 희망 비품 카테고리 키 배열 (projector, furniture, climate, lighting, cleaning, supplies)
  categories    text[] not null default '{}'::text[],
  -- 구체적으로 필요한 품목·모델 (자유 입력)
  custom_item   text not null default '',
  -- 운영 중이거나 준비 중인 공간 유형 (파티룸·촬영스튜디오·연습실 등)
  space_type    text not null default '',
  -- 희망 예산대 또는 수량 (선택)
  budget_or_qty text not null default '',
  -- 연락 수단 (phone | email) 과 연락처
  contact_type  text not null default 'phone',
  contact       text not null,
  -- 자유 요청사항
  note          text not null default '',
  -- 오픈 알림 수신 동의
  wants_notice  boolean not null default true,
  -- 유입 경로 (item 페이지 / host 센터 배너 등)
  source        text not null default 'item',
  created_at    timestamptz not null default now(),
  constraint item_waitlist_contact_type_check check (contact_type in ('phone', 'email')),
  constraint item_waitlist_contact_check check (length(btrim(contact)) between 5 and 120)
);

create index if not exists item_waitlist_created_idx
  on public.item_waitlist (created_at desc);

create index if not exists item_waitlist_contact_idx
  on public.item_waitlist (contact);

alter table public.item_waitlist enable row level security;

-- anon 은 아무 권한도 없다 (페이지의 신청 폼은 서버 API 를 거친다).
revoke all on table public.item_waitlist from anon;
-- authenticated 는 조회·삭제 권한만 갖고, 실제 행 접근은 아래 RLS 가 관리자로 제한한다.
revoke all on table public.item_waitlist from authenticated;
grant select, delete on table public.item_waitlist to authenticated, service_role;

drop policy if exists "item_waitlist_select_admin" on public.item_waitlist;
create policy "item_waitlist_select_admin"
  on public.item_waitlist for select
  to authenticated
  using (public.is_admin());

drop policy if exists "item_waitlist_delete_admin" on public.item_waitlist;
create policy "item_waitlist_delete_admin"
  on public.item_waitlist for delete
  to authenticated
  using (public.is_admin());

comment on table public.item_waitlist is
  '이곳저곳 Item 오픈 예고 페이지의 사전 수요조사·오픈 알림 신청. 삽입은 /api/item/waitlist(service_role)만, 조회·삭제는 총괄 관리자만 가능하다.';
