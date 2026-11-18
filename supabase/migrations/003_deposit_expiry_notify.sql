-- ============================================================
-- 003_deposit_expiry_notify.sql
-- 이곳저곳 — 입금 확인 플로우 · 15분 만료 자동 정리
--
--  1) space_accounts : 공간별 사장님 입금 계좌 (손님에게 직접 노출하지 않는 별도 테이블)
--  2) bookings.pay_* : 예약 시점의 입금 계좌 스냅샷 (손님은 자기 예약 행에서만 확인)
--  3) bookings.cancel_reason : 만료/거절/손님 취소 사유 구분
--  4) create_booking / create_booking_by_slug : 계좌 스냅샷 자동 복사
--  5) expire_pending_bookings() + pg_cron 1분 스케줄 : 15분 지난 pending 자동 취소
--
-- 여러 번 실행해도 안전하도록(idempotent) 작성했습니다.
-- ============================================================

-- ------------------------------------------------------------
-- 1. 사장님 입금 계좌
--    spaces 는 spaces_select_all 정책으로 누구나 조회할 수 있으므로,
--    계좌 정보는 별도 테이블에 두고 RLS 로 사장님 본인/관리자만 읽게 한다.
-- ------------------------------------------------------------
create table if not exists public.space_accounts (
  space_id       uuid primary key references public.spaces (id) on delete cascade,
  bank_name      text not null default '',
  account_number text not null default '',
  account_holder text not null default '',
  updated_at     timestamptz not null default now()
);

comment on table public.space_accounts is
  '공간별 사장님 입금 계좌. 손님 화면에는 예약 시점 스냅샷(bookings.pay_*)으로만 전달됩니다.';
comment on column public.space_accounts.bank_name is '은행명 (예: 국민은행)';
comment on column public.space_accounts.account_number is '계좌번호';
comment on column public.space_accounts.account_holder is '예금주';

alter table public.space_accounts enable row level security;

revoke all on table public.space_accounts from anon;
grant select, insert, update, delete on table public.space_accounts to authenticated;

-- 조회: 내 공간의 계좌, 또는 총괄 관리자
drop policy if exists "space_accounts_select_owner" on public.space_accounts;
create policy "space_accounts_select_owner"
  on public.space_accounts for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.spaces s
       where s.id = space_accounts.space_id
         and s.host_id = auth.uid()
    )
  );

-- 등록: 내 공간에만
drop policy if exists "space_accounts_insert_owner" on public.space_accounts;
create policy "space_accounts_insert_owner"
  on public.space_accounts for insert
  to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.spaces s
       where s.id = space_accounts.space_id
         and s.host_id = auth.uid()
    )
  );

-- 수정: 내 공간만
drop policy if exists "space_accounts_update_owner" on public.space_accounts;
create policy "space_accounts_update_owner"
  on public.space_accounts for update
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.spaces s
       where s.id = space_accounts.space_id
         and s.host_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.spaces s
       where s.id = space_accounts.space_id
         and s.host_id = auth.uid()
    )
  );

-- 삭제: 내 공간만 (공간 삭제 시에는 cascade)
drop policy if exists "space_accounts_delete_owner" on public.space_accounts;
create policy "space_accounts_delete_owner"
  on public.space_accounts for delete
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.spaces s
       where s.id = space_accounts.space_id
         and s.host_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 2. 예약 시점 입금 계좌 스냅샷 + 취소 사유
--    - 손님은 자기 예약 행(RLS: bookings_select_participants)에서만 계좌를 본다.
--    - 계좌를 나중에 바꿔도 이미 접수된 예약의 안내는 그대로 유지된다.
-- ------------------------------------------------------------
alter table public.bookings add column if not exists pay_bank_name text not null default '';
alter table public.bookings add column if not exists pay_account_number text not null default '';
alter table public.bookings add column if not exists pay_account_holder text not null default '';
alter table public.bookings add column if not exists cancel_reason text;

comment on column public.bookings.pay_bank_name is '예약 접수 시점의 입금 은행명 스냅샷';
comment on column public.bookings.pay_account_number is '예약 접수 시점의 입금 계좌번호 스냅샷';
comment on column public.bookings.pay_account_holder is '예약 접수 시점의 예금주 스냅샷';
comment on column public.bookings.cancel_reason is
  '취소 사유: expired(15분 미입금 자동 만료) / host(사장님 거절·취소) / guest(손님 취소) / null(기존 데이터)';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_cancel_reason_check'
  ) then
    alter table public.bookings
      add constraint bookings_cancel_reason_check
      check (cancel_reason is null or cancel_reason in ('expired', 'host', 'guest'));
  end if;
end
$$;

-- 만료 정리용 인덱스 (pending 행만)
create index if not exists bookings_pending_expiry_idx
  on public.bookings (expires_at)
  where status = 'pending';

-- ------------------------------------------------------------
-- 3. 예약 생성 RPC — 입금 계좌 스냅샷 복사
-- ------------------------------------------------------------
create or replace function public.create_booking(
  p_space     uuid,
  p_date      date,
  p_start_time text,
  p_hours     integer,
  p_guests    integer,
  p_guest_name text,
  p_guest_phone text,
  p_memo      text default '',
  p_guest_id  uuid default null,
  p_source    text default 'web'
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space   public.spaces%rowtype;
  v_account public.space_accounts%rowtype;
  v_start   timestamptz;
  v_end     timestamptz;
  v_amount  integer;
  v_booking public.bookings%rowtype;
begin
  if p_date is null then
    raise exception 'INVALID_DATE' using errcode = 'P0001';
  end if;
  if p_hours is null or p_hours < 1 or p_hours > 24 then
    raise exception 'INVALID_HOURS' using errcode = 'P0001';
  end if;
  if p_guests is null or p_guests < 1 then
    raise exception 'INVALID_GUESTS' using errcode = 'P0001';
  end if;
  if coalesce(btrim(p_guest_name), '') = '' or coalesce(btrim(p_guest_phone), '') = '' then
    raise exception 'INVALID_GUEST' using errcode = 'P0001';
  end if;
  if p_start_time is null or p_start_time !~ '^[0-2][0-9]:[0-5][0-9]$' then
    raise exception 'INVALID_TIME' using errcode = 'P0001';
  end if;

  select * into v_space from public.spaces where id = p_space;
  if not found then
    raise exception 'SPACE_NOT_FOUND' using errcode = 'P0001';
  end if;
  if p_guests > v_space.capacity then
    raise exception 'OVER_CAPACITY' using errcode = 'P0001';
  end if;

  v_start := (p_date::timestamp + p_start_time::interval) at time zone 'Asia/Seoul';
  v_end   := v_start + make_interval(hours => p_hours);

  if v_start <= now() then
    raise exception 'PAST_TIME' using errcode = 'P0001';
  end if;

  v_amount := public.calc_booking_amount(v_space.id, p_hours);
  if v_amount is null then
    raise exception 'SPACE_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into v_account from public.space_accounts where space_id = v_space.id;

  -- 만료된 pending 점유를 먼저 풀어준다 (같은 공간)
  update public.bookings b
     set status = 'cancelled',
         cancel_reason = coalesce(b.cancel_reason, 'expired')
   where b.space_id = v_space.id
     and b.status = 'pending'
     and (b.start_at is null
          or b.start_at < now()
          or (b.expires_at is not null and b.expires_at < now()));

  insert into public.bookings (
    space_id, space_name, host_id, guest_id,
    guest_name, guest_phone, date, start_time, hours, guests,
    total_amount, status, memo, source,
    start_at, end_at, expires_at,
    pay_bank_name, pay_account_number, pay_account_holder
  ) values (
    v_space.id,
    v_space.name,
    v_space.host_id,
    p_guest_id,
    btrim(p_guest_name),
    btrim(p_guest_phone),
    p_date,
    p_start_time,
    p_hours,
    p_guests,
    v_amount,
    'pending',
    coalesce(p_memo, ''),
    case when p_source = 'link' then 'link' else 'web' end,
    v_start,
    v_end,
    now() + interval '15 minutes',
    coalesce(v_account.bank_name, ''),
    coalesce(v_account.account_number, ''),
    coalesce(v_account.account_holder, '')
  )
  returning * into v_booking;

  return v_booking;

exception
  when exclusion_violation then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
end;
$$;

comment on function public.create_booking(uuid, date, text, integer, integer, text, text, text, uuid, text) is
  '예약 생성 RPC. 금액 재계산·과거 시간 차단·만료 pending 정리·중복 시간(SLOT_TAKEN) 차단·입금 계좌 스냅샷을 서버에서 처리합니다.';

create or replace function public.create_booking_by_slug(
  p_slug      text,
  p_date      date,
  p_start_time text,
  p_hours     integer,
  p_guests    integer,
  p_guest_name text,
  p_guest_phone text,
  p_memo      text default '',
  p_guest_id  uuid default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
begin
  if coalesce(btrim(p_slug), '') = '' then
    raise exception 'SPACE_NOT_FOUND' using errcode = 'P0001';
  end if;

  select s.id into v_space_id
    from public.spaces s
   where s.pay_slug = p_slug
      or s.id::text = p_slug
   limit 1;

  if v_space_id is null then
    raise exception 'SPACE_NOT_FOUND' using errcode = 'P0001';
  end if;

  return public.create_booking(
    v_space_id, p_date, p_start_time, p_hours, p_guests,
    p_guest_name, p_guest_phone, p_memo, p_guest_id, 'link'
  );
end;
$$;

revoke all on function public.create_booking(uuid, date, text, integer, integer, text, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.create_booking_by_slug(text, date, text, integer, integer, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_booking(uuid, date, text, integer, integer, text, text, text, uuid, text) to service_role;
grant execute on function public.create_booking_by_slug(text, date, text, integer, integer, text, text, text, uuid) to service_role;

-- ------------------------------------------------------------
-- 4. 15분 만료 자동 정리
--    pending 이면서 (입금 기한이 지났거나 이용 시작 시각이 지난) 예약을 취소한다.
--    bookings_no_overlap 은 pending/confirmed 만 잡으므로 cancelled 로 바꾸면
--    같은 시간대를 다른 손님이 다시 예약할 수 있다.
-- ------------------------------------------------------------
create or replace function public.expire_pending_bookings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  update public.bookings b
     set status = 'cancelled',
         cancel_reason = 'expired'
   where b.status = 'pending'
     and (
       (b.expires_at is not null and b.expires_at < now())
       or (b.start_at is not null and b.start_at < now())
     );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.expire_pending_bookings() is
  '입금 기한(15분)이 지난 pending 예약을 cancelled(사유 expired)로 정리하고 처리 건수를 돌려줍니다. pg_cron 이 1분마다 실행합니다.';

revoke all on function public.expire_pending_bookings() from public, anon, authenticated;
grant execute on function public.expire_pending_bookings() to service_role;

-- pg_cron 확장 + 1분 스케줄 (Supabase 무료 플랜에서도 동작)
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'expire-pending-bookings') then
      perform cron.unschedule('expire-pending-bookings');
    end if;
    perform cron.schedule(
      'expire-pending-bookings',
      '* * * * *',
      'select public.expire_pending_bookings();'
    );
    raise notice 'pg_cron job "expire-pending-bookings" scheduled every minute.';
  else
    raise notice 'pg_cron extension is not available. Use /api/cron/expire-bookings instead.';
  end if;
exception
  when others then
    raise notice 'pg_cron scheduling skipped: %', sqlerrm;
end
$$;

-- ------------------------------------------------------------
-- 5. 기존 pending 예약 중 이미 기한이 지난 건 정리
-- ------------------------------------------------------------
update public.bookings b
   set status = 'cancelled',
       cancel_reason = coalesce(b.cancel_reason, 'expired')
 where b.status = 'pending'
   and (
     (b.expires_at is not null and b.expires_at < now())
     or (b.start_at is not null and b.start_at < now())
   );
