-- ============================================================
-- 001_booking_integrity.sql
-- 이곳저곳 — 더블부킹 방지 + 서버 금액 재계산
--
--  1) btree_gist 확장
--  2) bookings.start_at / end_at / expires_at 추가 + 기존 데이터 백필
--  3) 기존 INSERT(클라이언트) 호환용 bookings_sync_range() 트리거
--  4) bookings_end_after_start / bookings_no_overlap 제약
--  5) calc_booking_amount / create_booking / create_booking_by_slug RPC
--
-- Supabase SQL Editor 또는 Management API 로 한 번에 실행할 수 있습니다.
-- 여러 번 실행해도 안전하도록( idempotent ) 작성했습니다.
-- ============================================================

-- ------------------------------------------------------------
-- 1. 확장
-- ------------------------------------------------------------
create extension if not exists btree_gist;

-- ------------------------------------------------------------
-- 2. 예약 시간 범위 컬럼
-- ------------------------------------------------------------
alter table public.bookings add column if not exists start_at timestamptz;
alter table public.bookings add column if not exists end_at timestamptz;
alter table public.bookings add column if not exists expires_at timestamptz;

comment on column public.bookings.start_at is '이용 시작 시각(Asia/Seoul 기준 date + start_time). 트리거가 자동 계산합니다.';
comment on column public.bookings.end_at   is '이용 종료 시각(start_at + hours). 트리거가 자동 계산합니다.';
comment on column public.bookings.expires_at is 'pending 예약의 임시 점유 만료 시각. 지나면 자동으로 취소됩니다.';

-- 기존 데이터 백필 (start_time 이 "HH:MM" 형식인 행만)
update public.bookings b
   set start_at = (b.date::timestamp + b.start_time::interval) at time zone 'Asia/Seoul'
 where b.start_at is null
   and b.start_time is not null
   and b.start_time ~ '^[0-2][0-9]:[0-5][0-9]$';

update public.bookings b
   set end_at = b.start_at + make_interval(hours => b.hours)
 where b.end_at is null
   and b.start_at is not null
   and b.hours is not null;

update public.bookings b
   set expires_at = b.created_at + interval '15 minutes'
 where b.expires_at is null
   and b.status = 'pending';

create index if not exists bookings_start_at_idx on public.bookings (start_at);

-- ------------------------------------------------------------
-- 3. 기존 INSERT 호환 트리거
--    (앱이 date/start_time/hours 만 넣어도 start_at·end_at·expires_at 을 채운다)
-- ------------------------------------------------------------
create or replace function public.bookings_sync_range()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.date is null
     or new.start_time is null
     or new.start_time !~ '^[0-2][0-9]:[0-5][0-9]$'
     or new.hours is null then
    raise exception 'INVALID_TIME' using errcode = 'P0001';
  end if;

  new.start_at := (new.date::timestamp + new.start_time::interval) at time zone 'Asia/Seoul';
  new.end_at := new.start_at + make_interval(hours => new.hours);

  if new.expires_at is null and coalesce(new.status, 'pending') = 'pending' then
    new.expires_at := now() + interval '15 minutes';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_sync_range on public.bookings;
create trigger bookings_sync_range
  before insert or update on public.bookings
  for each row execute function public.bookings_sync_range();

-- ------------------------------------------------------------
-- 3-1. 이미 지난 pending 예약 정리
--      (지난 날짜의 pending 은 아무도 쓰지 못하게 막고 있으므로 취소 처리)
-- ------------------------------------------------------------
update public.bookings b
   set status = 'cancelled'
 where b.status = 'pending'
   and (b.start_at is null
        or b.start_at < now()
        or (b.expires_at is not null and b.expires_at < now()));

-- ------------------------------------------------------------
-- 4. 제약
-- ------------------------------------------------------------
alter table public.bookings drop constraint if exists bookings_end_after_start;
alter table public.bookings
  add constraint bookings_end_after_start
  check (end_at is null or start_at is null or end_at > start_at);

alter table public.bookings drop constraint if exists bookings_no_overlap;
alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (
    space_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  ) where (
    status in ('pending', 'confirmed')
    and start_at is not null
    and end_at is not null
  );

comment on constraint bookings_no_overlap on public.bookings is
  '같은 공간의 pending/confirmed 예약은 시간이 겹칠 수 없습니다. (더블부킹 방지)';

-- ------------------------------------------------------------
-- 5. 금액 계산 / 예약 생성 RPC
-- ------------------------------------------------------------

-- 서버가 spaces 의 시간당 요금·할인율로 직접 계산한다. (클라이언트 금액 신뢰 X)
create or replace function public.calc_booking_amount(p_space uuid, p_hours integer)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
           when s.id is null then null
           when p_hours is null or p_hours < 1 then null
           else greatest(
                  0,
                  round(s.price_per_hour * p_hours * (100 - coalesce(s.discount_rate, 0)) / 100.0)
                )::integer
         end
    from public.spaces s
   where s.id = p_space;
$$;

comment on function public.calc_booking_amount(uuid, integer) is
  '공간 요금×시간에 할인율을 적용한 최종 결제 금액을 서버에서 계산합니다.';

-- 예약 생성 (공간 id 기준)
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

  -- 만료된 pending 점유를 먼저 풀어준다 (같은 공간)
  update public.bookings b
     set status = 'cancelled'
   where b.space_id = v_space.id
     and b.status = 'pending'
     and (b.start_at is null
          or b.start_at < now()
          or (b.expires_at is not null and b.expires_at < now()));

  insert into public.bookings (
    space_id, space_name, host_id, guest_id,
    guest_name, guest_phone, date, start_time, hours, guests,
    total_amount, status, memo, source,
    start_at, end_at, expires_at
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
    now() + interval '15 minutes'
  )
  returning * into v_booking;

  return v_booking;

exception
  when exclusion_violation then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
end;
$$;

comment on function public.create_booking(uuid, date, text, integer, integer, text, text, text, uuid, text) is
  '예약 생성 RPC. 금액 재계산·과거 시간 차단·만료 pending 정리·중복 시간(SLOT_TAKEN) 차단을 모두 서버에서 처리합니다.';

-- 예약 생성 (전용 결제 링크 slug 기준, 비로그인 허용)
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

comment on function public.create_booking_by_slug(text, date, text, integer, integer, text, text, text, uuid) is
  '전용 결제 링크(pay_slug) 예약 생성 RPC. 로그인 없이도 동작하며 내부적으로 create_booking 을 호출합니다.';

-- RPC 실행 권한: 서버(service_role)만. anon/authenticated 의 직접 호출은 막는다.
revoke all on function public.calc_booking_amount(uuid, integer) from public;
revoke all on function public.create_booking(uuid, date, text, integer, integer, text, text, text, uuid, text) from public;
revoke all on function public.create_booking_by_slug(text, date, text, integer, integer, text, text, text, uuid) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.calc_booking_amount(uuid, integer) to service_role';
    execute 'grant execute on function public.create_booking(uuid, date, text, integer, integer, text, text, text, uuid, text) to service_role';
    execute 'grant execute on function public.create_booking_by_slug(text, date, text, integer, integer, text, text, text, uuid) to service_role';
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 6. 예약 겹침 확인용 뷰 (사장님/관리자 확인, 디버깅)
-- ------------------------------------------------------------
create or replace view public.booking_conflicts as
select a.id as booking_id, b.id as conflict_id, a.space_id, a.start_at, a.end_at
  from public.bookings a
  join public.bookings b
    on a.space_id = b.space_id
   and a.id <> b.id
   and a.status in ('pending', 'confirmed')
   and b.status in ('pending', 'confirmed')
   and tstzrange(a.start_at, a.end_at, '[)') && tstzrange(b.start_at, b.end_at, '[)');

comment on view public.booking_conflicts is
  '겹치는 예약 쌍을 보여주는 점검용 뷰. 정상 운영 중에는 항상 비어 있어야 합니다.';

revoke all on public.booking_conflicts from anon, authenticated;
