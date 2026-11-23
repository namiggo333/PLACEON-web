-- ============================================================
-- 008_item_admin.sql
-- 이곳저곳 Item — 상품·재고 관리 + 수요조사·문의 처리 상태
--
--  1) item_products
--     - 총괄 관리자(/admin → Item 관리)가 등록하는 실제 판매 상품.
--     - 조회는 공개(숨김 상품 제외) — /item 페이지가 anon 키로 읽는다.
--     - 쓰기는 서버 API(/api/admin/items, service_role)만 한다.
--       anon/authenticated 에 insert·update·delete 권한을 주지 않는다.
--  2) item_waitlist 확장
--     - 처리 상태(status: new | contacted | done)와 관리자 메모(admin_memo).
--     - 기존 행은 status='new', admin_memo='' 로 채워져 그대로 호환된다.
--     - 수정은 총괄 관리자만(RLS is_admin()), 실제 저장은 서버 API 를 거친다.
--  3) idempotent — 여러 번 실행해도 안전하다.
-- ============================================================

-- ------------------------------------------------------------
-- 1. 상품 테이블
-- ------------------------------------------------------------
create table if not exists public.item_products (
  id          uuid primary key default gen_random_uuid(),
  -- 상품명 (예: 엡손 EB-970 프로젝터)
  name        text not null,
  -- 카테고리 키 (lib/constants.ts ITEM_CATEGORIES 와 같은 키)
  category    text not null default 'supplies',
  -- 간단한 설명·상태 등급
  description text not null default '',
  -- 판매가(원)
  price       integer not null default 0,
  -- 판매 단위 (예: 1대, 1세트(10개))
  unit        text not null default '1개',
  -- 재고 수량
  stock       integer not null default 0,
  -- 판매 상태: 판매중 | 입고대기 | 품절 | 숨김
  status      text not null default 'active',
  -- 대표 이미지 URL (외부 URL 또는 /images/... 경로)
  image_url   text,
  -- 목록 정렬 (작을수록 먼저)
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint item_products_category_check
    check (category in ('projector', 'furniture', 'climate', 'lighting', 'cleaning', 'supplies')),
  constraint item_products_status_check
    check (status in ('active', 'restocking', 'soldout', 'hidden')),
  constraint item_products_name_check
    check (length(btrim(name)) between 1 and 80),
  constraint item_products_price_check
    check (price >= 0 and price <= 100000000),
  constraint item_products_stock_check
    check (stock >= 0 and stock <= 1000000)
);

create index if not exists item_products_order_idx
  on public.item_products (sort_order asc, created_at desc);

create index if not exists item_products_status_idx
  on public.item_products (status);

-- updated_at 자동 갱신
create or replace function public.item_products_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists item_products_touch on public.item_products;
create trigger item_products_touch
  before update on public.item_products
  for each row execute function public.item_products_touch_updated_at();

alter table public.item_products enable row level security;

-- 공개 조회(숨김 제외)만 허용. 쓰기 권한은 anon/authenticated 에 주지 않는다.
revoke all on table public.item_products from anon, authenticated;
grant select on table public.item_products to anon, authenticated, service_role;
grant insert, update, delete on table public.item_products to service_role;

drop policy if exists "item_products_select_public" on public.item_products;
create policy "item_products_select_public"
  on public.item_products for select
  to anon, authenticated
  using (status <> 'hidden');

drop policy if exists "item_products_select_admin" on public.item_products;
create policy "item_products_select_admin"
  on public.item_products for select
  to authenticated
  using (public.is_admin());

comment on table public.item_products is
  '이곳저곳 Item 판매 상품·재고. 조회는 숨김 제외 공개, 등록·수정·삭제는 /api/admin/items(service_role, 총괄 관리자 검증)만 가능하다.';

-- ------------------------------------------------------------
-- 2. 수요조사·문의 처리 상태 확장
-- ------------------------------------------------------------
alter table public.item_waitlist
  add column if not exists status text not null default 'new',
  add column if not exists admin_memo text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'item_waitlist_status_check'
       and conrelid = 'public.item_waitlist'::regclass
  ) then
    alter table public.item_waitlist
      add constraint item_waitlist_status_check
      check (status in ('new', 'contacted', 'done'));
  end if;
end;
$$;

create index if not exists item_waitlist_status_idx
  on public.item_waitlist (status, created_at desc);

-- 조회·삭제에 이어 수정도 총괄 관리자만.
grant update on table public.item_waitlist to authenticated, service_role;

drop policy if exists "item_waitlist_update_admin" on public.item_waitlist;
create policy "item_waitlist_update_admin"
  on public.item_waitlist for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

comment on column public.item_waitlist.status is
  '문의 처리 상태: new(접수) | contacted(연락완료) | done(처리완료)';
comment on column public.item_waitlist.admin_memo is
  '관리자 메모(처리 내용·연락 결과)';
