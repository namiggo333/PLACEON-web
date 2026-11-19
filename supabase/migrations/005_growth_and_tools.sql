-- ============================================================
-- 005_growth_and_tools.sql
-- 이곳저곳 6~10단계 — 유입·편의 기능
--
--  1) iCal 구독 토큰 (space_ical_tokens)
--     - 공간별 구독 토큰을 별도 테이블에 둬서, 공개 공간(spaces) 조회로는
--       토큰이 노출되지 않게 한다. (토큰만 있으면 시간만 담긴 .ics 를 구독할 수 있다)
--     - RLS: 사장님 본인 · 관리자만 조회/발급. anon 정책 없음(=비공개).
--  2) 6~10단계 조회용 보조 인덱스 (sitemap·동네 랜딩·월간 리포트)
--     - 모두 idempotent (if not exists) — 여러 번 실행해도 안전하다.
-- ============================================================

-- ------------------------------------------------------------
-- 1. iCal 구독 토큰
-- ------------------------------------------------------------
create table if not exists public.space_ical_tokens (
  space_id   uuid primary key references public.spaces (id) on delete cascade,
  token      uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create unique index if not exists space_ical_tokens_token_key
  on public.space_ical_tokens (token);

alter table public.space_ical_tokens enable row level security;

revoke all on table public.space_ical_tokens from anon;
grant select, insert, update, delete on table public.space_ical_tokens to authenticated, service_role;

-- 사장님 본인(또는 관리자)만 자기 공간의 구독 토큰을 볼 수 있다.
drop policy if exists "space_ical_tokens_select_owner" on public.space_ical_tokens;
create policy "space_ical_tokens_select_owner"
  on public.space_ical_tokens for select
  to authenticated
  using (
    exists (
      select 1 from public.spaces s
       where s.id = space_ical_tokens.space_id
         and s.host_id = auth.uid()
    )
    or public.is_admin()
  );

drop policy if exists "space_ical_tokens_insert_owner" on public.space_ical_tokens;
create policy "space_ical_tokens_insert_owner"
  on public.space_ical_tokens for insert
  to authenticated
  with check (
    exists (
      select 1 from public.spaces s
       where s.id = space_ical_tokens.space_id
         and s.host_id = auth.uid()
    )
    or public.is_admin()
  );

drop policy if exists "space_ical_tokens_update_owner" on public.space_ical_tokens;
create policy "space_ical_tokens_update_owner"
  on public.space_ical_tokens for update
  to authenticated
  using (
    exists (
      select 1 from public.spaces s
       where s.id = space_ical_tokens.space_id
         and s.host_id = auth.uid()
    )
    or public.is_admin()
  )
  with check (
    exists (
      select 1 from public.spaces s
       where s.id = space_ical_tokens.space_id
         and s.host_id = auth.uid()
    )
    or public.is_admin()
  );

comment on table public.space_ical_tokens is
  '공간별 iCal 구독 토큰. 토큰을 가진 사람만 /api/spaces/[id]/ical 로 시간 요약(.ics)을 구독할 수 있다. 손님 개인정보는 피드에 포함하지 않는다.';

-- ------------------------------------------------------------
-- 2. 보조 인덱스 (idempotent)
-- ------------------------------------------------------------
create index if not exists spaces_public_listing_idx
  on public.spaces (region, category)
  where approval_status = 'approved' and is_hidden = false;

create index if not exists bookings_host_month_idx
  on public.bookings (host_id, date, source, status);
