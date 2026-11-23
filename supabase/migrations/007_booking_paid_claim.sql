-- ============================================================
-- 007_booking_paid_claim.sql
-- 이곳저곳 — 손님 '입금했어요' 신호 + 만료 보호
--
--  1) bookings.paid_claimed_at : 손님이 입금 신고를 누른 시각
--  2) bookings.depositor_name  : 손님이 적은 입금자명 (사장님이 통장과 대조)
--  3) expire_pending_bookings() : 신고된 예약은 12시간 동안 만료 보류
--  4) create_booking() 내부 만료 정리, get_occupied_slots() 내부 만료 정리에도 같은 보호 적용
--  5) get_soldout_spaces() : 목록 카드의 '오늘 마감' 배지용 (공간 배열 + 날짜 → 마감 공간 id)
--
-- 여러 번 실행해도 안전하도록(idempotent) 작성했습니다.
-- ============================================================

-- ------------------------------------------------------------
-- 1. 컬럼
-- ------------------------------------------------------------
alter table public.bookings add column if not exists paid_claimed_at timestamptz;
alter table public.bookings add column if not exists depositor_name text not null default '';

comment on column public.bookings.paid_claimed_at is
  '손님이 [입금했어요]를 누른 시각. 있으면 15분 자동 만료를 12시간 보류한다(사장님 확인 대기).';
comment on column public.bookings.depositor_name is
  '손님이 입력한 입금자명. 사장님이 통장 거래내역과 대조하는 값.';

-- 사장님 큐(입금 확인 대기) 조회용
create index if not exists bookings_paid_claim_idx
  on public.bookings (paid_claimed_at desc)
  where status = 'pending';

-- ------------------------------------------------------------
-- 2. 15분 만료 자동 정리 — 입금 신고된 예약은 12시간 보호
--    (기존 정의 유지 + paid_claimed_at 조건만 추가)
-- ------------------------------------------------------------
create or replace function public.expire_pending_bookings()
returns integer
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_count integer := 0;
begin
  perform set_config('app.actor', 'system', true);

  update public.bookings b
     set status = 'cancelled',
         cancel_reason = 'expired'
   where b.status = 'pending'
     and b.source = 'guest'
     -- 손님이 입금 신호를 보낸 예약은 12시간까지 기다린다(거짓 신호로 슬롯이 무기한 잠기지 않도록 상한).
     and (b.paid_claimed_at is null or b.paid_claimed_at < now() - interval '12 hours')
     and (
       (b.expires_at is not null and b.expires_at < now())
       or (b.start_at is not null and b.start_at < now())
     );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.expire_pending_bookings() is
  '입금 기한(15분)이 지난 pending 예약을 cancelled(사유 expired)로 정리한다. 손님이 입금 신고를 누른 예약은 12시간 보류. pg_cron 이 1분마다 실행.';

revoke all on function public.expire_pending_bookings() from public, anon, authenticated;
grant execute on function public.expire_pending_bookings() to service_role;

-- ------------------------------------------------------------
-- 3. create_booking — 내부 만료 정리에도 보호 적용
--    (p_access_token_hash 를 포함한 현재 시그니처 그대로)
-- ------------------------------------------------------------
create or replace function public.create_booking(
  p_space uuid,
  p_date date,
  p_start_time text,
  p_hours integer,
  p_guests integer,
  p_guest_name text,
  p_guest_phone text,
  p_memo text default '',
  p_guest_id uuid default null,
  p_channel text default 'web',
  p_access_token_hash text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = 'public'
as $function$
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
  if v_space.id is null then
    raise exception 'SPACE_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_space.approval_status is distinct from 'approved' then
    raise exception 'SPACE_NOT_APPROVED' using errcode = 'P0001';
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

  -- 만료된 pending 점유를 먼저 풀어준다 (같은 공간). 입금 신고된 예약은 12시간 보호.
  perform set_config('app.actor', 'system', true);
  update public.bookings b
     set status = 'cancelled',
         cancel_reason = coalesce(b.cancel_reason, 'expired')
   where b.space_id = v_space.id
     and b.status = 'pending'
     and (b.paid_claimed_at is null or b.paid_claimed_at < now() - interval '12 hours')
     and (b.start_at is null
          or b.start_at < now()
          or (b.expires_at is not null and b.expires_at < now()));

  perform set_config('app.actor', 'guest', true);
  if p_guest_id is not null then
    perform set_config('app.actor_id', p_guest_id::text, true);
  end if;

  insert into public.bookings (
    space_id, space_name, host_id, guest_id,
    guest_name, guest_phone, date, start_time, hours, guests,
    total_amount, status, memo, channel, source, access_token_hash,
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
    case when p_channel = 'link' then 'link' else 'web' end,
    'guest',
    nullif(p_access_token_hash, ''),
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
$function$;

comment on function public.create_booking(uuid, date, text, integer, integer, text, text, text, uuid, text, text) is
  '예약 생성 RPC. 금액 재계산·과거 시간 차단·만료 pending 정리(입금 신고 12시간 보호)·중복 시간(SLOT_TAKEN) 차단·입금 계좌 스냅샷을 서버에서 처리합니다.';

revoke all on function public.create_booking(uuid, date, text, integer, integer, text, text, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_booking(uuid, date, text, integer, integer, text, text, text, uuid, text, text) to service_role;

-- ------------------------------------------------------------
-- 4. get_occupied_slots — 화면에 보여 주는 점유 상태도 같은 보호 적용
-- ------------------------------------------------------------
create or replace function public.get_occupied_slots(p_space uuid, p_from date, p_to date)
returns table(start_at timestamp with time zone, end_at timestamp with time zone, source text)
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if p_space is null or p_from is null or p_to is null then
    return;
  end if;

  -- 입금 기한이 지난 pending 점유는 먼저 풀어 실제 점유 상태와 화면을 맞춘다.
  -- (손님이 입금 신고를 누른 예약은 12시간 보호)
  update public.bookings b
     set status = 'cancelled',
         cancel_reason = coalesce(b.cancel_reason, 'expired')
   where b.space_id = p_space
     and b.status = 'pending'
     and (b.paid_claimed_at is null or b.paid_claimed_at < now() - interval '12 hours')
     and (
       (b.expires_at is not null and b.expires_at < now())
       or (b.start_at is not null and b.start_at < now())
     );

  return query
    select b.start_at,
           b.end_at,
           b.source
      from public.bookings b
     where b.space_id = p_space
       and b.status in ('pending', 'confirmed')
       and b.start_at is not null
       and b.end_at is not null
       and b.start_at < ((p_to + 1)::timestamp at time zone 'Asia/Seoul')
       and b.end_at > (p_from::timestamp at time zone 'Asia/Seoul')
     order by b.start_at;
end;
$$;

comment on function public.get_occupied_slots(uuid, date, date) is
  '공간·날짜 범위의 점유 시간대(이름·연락처 없음). 만료 pending 은 정리하되 입금 신고된 예약은 12시간 유지.';

-- ------------------------------------------------------------
-- 5. 오늘 마감 공간 — 목록 카드 배지용
--    그 날짜(기본 오늘)에 예약 가능한 시작 시간(08~22시)이 하나도 없는 공간 id 를 돌려준다.
-- ------------------------------------------------------------
create or replace function public.get_soldout_spaces(p_ids uuid[], p_date date)
returns table(space_id uuid)
language sql
stable
security definer
set search_path = 'public'
as $$
  with slots as (
    select gs as slot_start
      from generate_series(
             (p_date::timestamp + time '08:00') at time zone 'Asia/Seoul',
             (p_date::timestamp + time '22:00') at time zone 'Asia/Seoul',
             interval '1 hour'
           ) as gs
     where gs > now()
  )
  select s.id as space_id
    from public.spaces s
   where p_ids is not null
     and s.id = any(p_ids)
     and not exists (
       select 1
         from slots sl
        where not exists (
          select 1
            from public.bookings b
           where b.space_id = s.id
             and b.status in ('pending', 'confirmed')
             and b.start_at is not null
             and b.end_at is not null
             and sl.slot_start < b.end_at
             and b.start_at < sl.slot_start + interval '1 hour'
        )
     );
$$;

comment on function public.get_soldout_spaces(uuid[], date) is
  '주어진 공간들 중 그 날짜에 예약 가능한 시작 시간이 하나도 없는(오늘 마감) 공간 id. 목록 카드 배지용.';

revoke all on function public.get_soldout_spaces(uuid[], date) from public;
grant execute on function public.get_soldout_spaces(uuid[], date) to anon, authenticated, service_role;
