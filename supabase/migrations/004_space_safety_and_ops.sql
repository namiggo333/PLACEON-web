-- ============================================================
-- 004_space_safety_and_ops.sql
-- 이곳저곳 1~5단계 — 핵심 안전·예약·운영 기능
--
--  1) 공간 승인 게이트 (계좌 바꿔치기 방지 포함)
--     - spaces.approval_status / rejection_reason / approved_at
--     - 공개 화면은 approved 만, 사장님은 내 공간, 관리자는 전체
--     - space_accounts 가 등록·변경되면 자동으로 pending_review 로 되돌린다
--  2) 빈 시간표 RPC (개인정보 없이 점유 시간만) + 사장님 시간 차단(source='block')
--     - bookings.source 는 이제 'guest' | 'block' (기존 채널 값은 bookings.channel 로 이동)
--  3) 확정 후 상세주소·입장가이드 공개 (spaces_private + access_token_hash)
--  4) 취소·환불 상태 분리(refund_status) + 변경 이력(booking_events)
--
-- 여러 번 실행해도 안전하도록(idempotent) 작성했습니다.
-- ============================================================

-- ------------------------------------------------------------
-- 1. 공간 승인 게이트
-- ------------------------------------------------------------
do $$
declare
  v_new_column boolean := not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'spaces' and column_name = 'approval_status'
  );
begin
  if v_new_column then
    alter table public.spaces
      add column approval_status text not null default 'pending_review'
      check (approval_status in ('pending_review', 'approved', 'rejected'));
    alter table public.spaces add column if not exists rejection_reason text;
    alter table public.spaces add column if not exists approved_at timestamptz;

    -- 컬럼을 처음 만드는 순간에만: 이미 운영 중이던 공간은 승인 상태로 올린다.
    update public.spaces
       set approval_status = 'approved',
           approved_at = now()
     where approval_status is distinct from 'approved';
  end if;
end
$$;

alter table public.spaces add column if not exists rejection_reason text;
alter table public.spaces add column if not exists approved_at timestamptz;

comment on column public.spaces.approval_status is
  '공간 공개 승인 상태: pending_review(검수 대기) / approved(공개) / rejected(반려). 공개 화면·예약은 approved 만 허용.';
comment on column public.spaces.rejection_reason is '관리자가 반려한 사유(사장님 센터에 표시)';
comment on column public.spaces.approved_at is '마지막 승인 시각';

create index if not exists spaces_approval_status_idx on public.spaces (approval_status);

-- is_admin() 은 공개 조회 정책(anon)에서도 쓰이므로 anon 실행 권한을 함께 준다.
grant execute on function public.is_admin() to anon;

-- 공개 조회: 승인된 공간 + 내 공간(사장님) + 관리자 전체
drop policy if exists "spaces_select_all" on public.spaces;
drop policy if exists "spaces_select_visible" on public.spaces;
create policy "spaces_select_visible"
  on public.spaces for select
  using (
    approval_status = 'approved'
    or host_id = auth.uid()
    or public.is_admin()
  );

-- 사장님이 스스로 승인 상태를 바꾸지 못하게 막는다(관리자·서버만 변경).
create or replace function public.spaces_guard_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.approval_status := 'pending_review';
      new.rejection_reason := null;
      new.approved_at := null;
    else
      new.approval_status := old.approval_status;
      new.rejection_reason := old.rejection_reason;
      new.approved_at := old.approved_at;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists spaces_guard_approval on public.spaces;
create trigger spaces_guard_approval
  before insert or update on public.spaces
  for each row execute function public.spaces_guard_approval();

comment on function public.spaces_guard_approval() is
  '사장님(anon/authenticated)이 approval_status 를 직접 approved 로 바꾸지 못하게 한다. 관리자·service_role 은 통과.';

-- 계좌가 등록·변경되면 재승인 대기로 되돌린다 (계좌 바꿔치기 사기 방지)
create or replace function public.space_accounts_require_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and old.bank_name is not distinct from new.bank_name
     and old.account_number is not distinct from new.account_number
     and old.account_holder is not distinct from new.account_holder then
    return new;
  end if;

  update public.spaces
     set approval_status = 'pending_review',
         rejection_reason = null,
         approved_at = null
   where id = new.space_id
     and approval_status <> 'pending_review';
  return new;
end;
$$;

drop trigger if exists space_accounts_require_review on public.space_accounts;
create trigger space_accounts_require_review
  after insert or update of bank_name, account_number, account_holder on public.space_accounts
  for each row
  execute function public.space_accounts_require_review();

comment on function public.space_accounts_require_review() is
  '입금 계좌가 새로 등록되거나 바뀌면 해당 공간을 pending_review 로 되돌려 관리자 재승인 전까지 공개·결제를 막는다.';

-- 관리자 승인/반려
create or replace function public.set_space_approval(
  p_space_id uuid,
  p_status   text,
  p_reason   text default '',
  p_actor    text default 'admin',
  p_actor_id uuid default null
)
returns public.spaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space public.spaces%rowtype;
begin
  if p_status not in ('pending_review', 'approved', 'rejected') then
    raise exception 'INVALID_APPROVAL_STATUS' using errcode = 'P0001';
  end if;

  perform set_config('app.actor', coalesce(p_actor, 'admin'), true);
  if p_actor_id is not null then
    perform set_config('app.actor_id', p_actor_id::text, true);
  end if;

  update public.spaces
     set approval_status = p_status,
         rejection_reason = case when p_status = 'rejected' then nullif(btrim(coalesce(p_reason, '')), '') else null end,
         approved_at = case when p_status = 'approved' then now() else null end
   where id = p_space_id
  returning * into v_space;

  if v_space.id is null then
    raise exception 'SPACE_NOT_FOUND' using errcode = 'P0001';
  end if;

  return v_space;
end;
$$;

revoke all on function public.set_space_approval(uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.set_space_approval(uuid, text, text, text, uuid) to service_role;

-- ------------------------------------------------------------
-- 2. 점유 시간 · 사장님 시간 차단
-- ------------------------------------------------------------
-- 2-1. bookings.source 를 'guest' | 'block' 으로 정의하기 위해
--      기존의 유입 채널 값(web/link)은 bookings.channel 로 옮긴다.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'bookings' and column_name = 'source'
  ) and not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'bookings' and column_name = 'channel'
  ) then
    alter table public.bookings rename column source to channel;
    if exists (select 1 from pg_constraint where conname = 'bookings_source_check') then
      alter table public.bookings rename constraint bookings_source_check to bookings_channel_check;
    end if;
  end if;
end
$$;

alter table public.bookings add column if not exists channel text not null default 'web';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_channel_check') then
    alter table public.bookings
      add constraint bookings_channel_check check (channel in ('web', 'link'));
  end if;
end
$$;

alter table public.bookings add column if not exists source text not null default 'guest';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_source_kind_check') then
    alter table public.bookings
      add constraint bookings_source_kind_check check (source in ('guest', 'block'));
  end if;
end
$$;

comment on column public.bookings.source is '예약 종류: guest(손님 예약) / block(사장님 시간 차단). 매출·정산 집계에서는 block 을 제외한다.';
comment on column public.bookings.channel is '예약 유입 채널: web(사이트) / link(전용 결제 링크)';

alter table public.bookings add column if not exists refund_status text not null default 'none';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_refund_status_check') then
    alter table public.bookings
      add constraint bookings_refund_status_check check (refund_status in ('none', 'pending', 'completed'));
  end if;
end
$$;

comment on column public.bookings.refund_status is '환불 진행 상태: none(해당 없음) / pending(환불 필요) / completed(환불 완료). 취소된 예약에서만 의미가 있다.';

alter table public.bookings add column if not exists access_token_hash text;
comment on column public.bookings.access_token_hash is
  '비로그인 예약 확인용 access_token 의 SHA-256 해시. 평문은 예약 접수 응답에서 한 번만 전달한다.';

alter table public.bookings add column if not exists created_by uuid;
comment on column public.bookings.created_by is '차단(block) 행을 만든 사장님 계정 id';

create index if not exists bookings_source_idx on public.bookings (source);

-- 2-2. 예약 변경 이력
create table if not exists public.booking_events (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status   text,
  actor       text not null default 'system',
  actor_id    uuid,
  memo        text not null default '',
  created_at  timestamptz not null default now()
);

comment on table public.booking_events is
  '예약 상태 변경 이력. 예약 생성·입금 확인·거절·만료·취소·환불·시간 차단/해제를 시각·행위자와 함께 남긴다.';
comment on column public.booking_events.event_type is
  'created / confirmed / rejected / expired / cancelled / reopened / blocked / unblocked / refund_pending / refund_completed / status_changed';

create index if not exists booking_events_booking_idx on public.booking_events (booking_id, created_at);

alter table public.booking_events enable row level security;
revoke all on table public.booking_events from anon;
grant select on table public.booking_events to authenticated;

drop policy if exists "booking_events_select_participants" on public.booking_events;
create policy "booking_events_select_participants"
  on public.booking_events for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.bookings b
       where b.id = booking_events.booking_id
         and (b.host_id = auth.uid() or b.guest_id = auth.uid())
    )
  );

-- 2-3. 변경 이력 자동 기록 트리거
create or replace function public.bookings_log_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text := coalesce(nullif(current_setting('app.actor', true), ''), 'system');
  v_actor_id uuid := nullif(current_setting('app.actor_id', true), '')::uuid;
  v_type text;
  v_memo text := '';
begin
  if tg_op = 'INSERT' then
    v_type := case when new.source = 'block' then 'blocked' else 'created' end;
    insert into public.booking_events (booking_id, event_type, from_status, to_status, actor, actor_id, memo)
    values (new.id, v_type, null, new.status, v_actor, v_actor_id, coalesce(new.memo, ''));
    return new;
  end if;

  if new.status is distinct from old.status then
    v_type := case
      when new.status = 'confirmed' and old.status = 'pending' then 'confirmed'
      when new.status = 'cancelled' and old.status = 'pending' and new.cancel_reason = 'expired' then 'expired'
      when new.status = 'cancelled' and old.status = 'pending' then 'rejected'
      when new.status = 'cancelled' and new.source = 'block' then 'unblocked'
      when new.status = 'cancelled' then 'cancelled'
      when new.status = 'pending' and old.status = 'cancelled' then 'reopened'
      else 'status_changed'
    end;
    insert into public.booking_events (booking_id, event_type, from_status, to_status, actor, actor_id, memo)
    values (new.id, v_type, old.status, new.status, v_actor, v_actor_id, coalesce(new.cancel_reason, ''));
  end if;

  if new.refund_status is distinct from old.refund_status then
    v_type := case new.refund_status
      when 'pending' then 'refund_pending'
      when 'completed' then 'refund_completed'
      else 'refund_cancelled'
    end;
    insert into public.booking_events (booking_id, event_type, from_status, to_status, actor, actor_id, memo)
    values (new.id, v_type, old.refund_status, new.refund_status, v_actor, v_actor_id, '');
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_log_event on public.bookings;
create trigger bookings_log_event
  after insert or update on public.bookings
  for each row execute function public.bookings_log_event();

-- 2-4. 점유 시간 조회 RPC — 개인정보 없이 시간만 돌려준다.
create or replace function public.get_occupied_slots(
  p_space uuid,
  p_from  date,
  p_to    date
)
returns table (start_at timestamptz, end_at timestamptz, source text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_space is null or p_from is null or p_to is null then
    return;
  end if;

  -- 입금 기한이 지난 pending 점유는 먼저 풀어 실제 점유 상태와 화면을 맞춘다.
  update public.bookings b
     set status = 'cancelled',
         cancel_reason = coalesce(b.cancel_reason, 'expired')
   where b.space_id = p_space
     and b.status = 'pending'
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
  '공간·날짜 범위의 점유 시간대(start_at, end_at, source)만 반환한다. 이름·연락처 등 개인정보는 포함하지 않으며 anon 도 호출할 수 있다.';

revoke all on function public.get_occupied_slots(uuid, date, date) from public;
grant execute on function public.get_occupied_slots(uuid, date, date) to anon, authenticated, service_role;

-- 2-5. 사장님 시간 차단 / 해제
create or replace function public.create_space_block(
  p_space      uuid,
  p_date       date,
  p_start_time text,
  p_hours      integer,
  p_memo       text default '',
  p_actor_id   uuid default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space public.spaces%rowtype;
  v_booking public.bookings%rowtype;
begin
  if p_date is null then
    raise exception 'INVALID_DATE' using errcode = 'P0001';
  end if;
  if p_start_time is null or p_start_time !~ '^[0-2][0-9]:[0-5][0-9]$' then
    raise exception 'INVALID_TIME' using errcode = 'P0001';
  end if;
  if p_hours is null or p_hours < 1 or p_hours > 24 then
    raise exception 'INVALID_HOURS' using errcode = 'P0001';
  end if;

  perform set_config('app.actor', 'host', true);
  if p_actor_id is not null then
    perform set_config('app.actor_id', p_actor_id::text, true);
  end if;

  select * into v_space from public.spaces where id = p_space;
  if v_space.id is null then
    raise exception 'SPACE_NOT_FOUND' using errcode = 'P0001';
  end if;

  if (p_date::timestamp + p_start_time::interval) at time zone 'Asia/Seoul' <= now() then
    raise exception 'PAST_TIME' using errcode = 'P0001';
  end if;

  insert into public.bookings (
    space_id, space_name, host_id, guest_id,
    guest_name, guest_phone, date, start_time, hours, guests,
    total_amount, status, memo, channel, source, created_by,
    start_at, end_at, expires_at
  ) values (
    v_space.id,
    v_space.name,
    v_space.host_id,
    null,
    '(사장님 시간 차단)',
    '-',
    p_date,
    p_start_time,
    p_hours,
    1,
    0,
    'confirmed',
    coalesce(p_memo, ''),
    'web',
    'block',
    p_actor_id,
    null,
    null,
    null
  )
  returning * into v_booking;

  return v_booking;

exception
  when exclusion_violation then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
end;
$$;

revoke all on function public.create_space_block(uuid, date, text, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.create_space_block(uuid, date, text, integer, text, uuid) to service_role;

create or replace function public.release_space_block(
  p_booking_id uuid,
  p_actor_id   uuid default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
begin
  perform set_config('app.actor', 'host', true);
  if p_actor_id is not null then
    perform set_config('app.actor_id', p_actor_id::text, true);
  end if;

  update public.bookings
     set status = 'cancelled',
         cancel_reason = 'host'
   where id = p_booking_id
     and source = 'block'
  returning * into v_booking;

  if v_booking.id is null then
    raise exception 'BLOCK_NOT_FOUND' using errcode = 'P0001';
  end if;

  return v_booking;
end;
$$;

revoke all on function public.release_space_block(uuid, uuid) from public, anon, authenticated;
grant execute on function public.release_space_block(uuid, uuid) to service_role;

-- ------------------------------------------------------------
-- 3. 상세주소·입장가이드 (확정 후에만)
-- ------------------------------------------------------------
create table if not exists public.spaces_private (
  space_id       uuid primary key references public.spaces (id) on delete cascade,
  detail_address text not null default '',
  entry_guide    text not null default '',
  parking_guide  text not null default '',
  updated_at     timestamptz not null default now()
);

comment on table public.spaces_private is
  '공간 상세주소·출입 안내·주차 안내. RLS 로 일반 공개를 막고, 예약 확정(confirmed) 손님에게만 서버 API 가 내려준다.';

alter table public.spaces_private enable row level security;
revoke all on table public.spaces_private from anon;
grant select, insert, update, delete on table public.spaces_private to authenticated;

drop policy if exists "spaces_private_select_owner" on public.spaces_private;
create policy "spaces_private_select_owner"
  on public.spaces_private for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.spaces s
       where s.id = spaces_private.space_id and s.host_id = auth.uid()
    )
  );

drop policy if exists "spaces_private_insert_owner" on public.spaces_private;
create policy "spaces_private_insert_owner"
  on public.spaces_private for insert
  to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.spaces s
       where s.id = spaces_private.space_id and s.host_id = auth.uid()
    )
  );

drop policy if exists "spaces_private_update_owner" on public.spaces_private;
create policy "spaces_private_update_owner"
  on public.spaces_private for update
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.spaces s
       where s.id = spaces_private.space_id and s.host_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.spaces s
       where s.id = spaces_private.space_id and s.host_id = auth.uid()
    )
  );

drop policy if exists "spaces_private_delete_owner" on public.spaces_private;
create policy "spaces_private_delete_owner"
  on public.spaces_private for delete
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.spaces s
       where s.id = spaces_private.space_id and s.host_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 4. 예약 생성 RPC — 승인 게이트 · source='guest' · access_token 해시 · 이력
-- ------------------------------------------------------------
drop function if exists public.create_booking(uuid, date, text, integer, integer, text, text, text, uuid, text);
drop function if exists public.create_booking_by_slug(text, date, text, integer, integer, text, text, text, uuid);

create or replace function public.create_booking(
  p_space             uuid,
  p_date              date,
  p_start_time        text,
  p_hours             integer,
  p_guests            integer,
  p_guest_name        text,
  p_guest_phone       text,
  p_memo              text default '',
  p_guest_id          uuid default null,
  p_channel           text default 'web',
  p_access_token_hash text default null
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

  -- 만료된 pending 점유를 먼저 풀어준다 (같은 공간)
  perform set_config('app.actor', 'system', true);
  update public.bookings b
     set status = 'cancelled',
         cancel_reason = coalesce(b.cancel_reason, 'expired')
   where b.space_id = v_space.id
     and b.status = 'pending'
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
$$;

comment on function public.create_booking(uuid, date, text, integer, integer, text, text, text, uuid, text, text) is
  '예약 생성 RPC. 승인된 공간만 허용하고, 금액 재계산·과거 시간 차단·만료 pending 정리·중복 시간(SLOT_TAKEN) 차단·입금 계좌 스냅샷·access_token 해시 저장을 처리한다.';

create or replace function public.create_booking_by_slug(
  p_slug              text,
  p_date              date,
  p_start_time        text,
  p_hours             integer,
  p_guests            integer,
  p_guest_name        text,
  p_guest_phone       text,
  p_memo              text default '',
  p_guest_id          uuid default null,
  p_access_token_hash text default null
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
   limit 1;

  if v_space_id is null then
    raise exception 'SPACE_NOT_FOUND' using errcode = 'P0001';
  end if;

  return public.create_booking(
    v_space_id, p_date, p_start_time, p_hours, p_guests,
    p_guest_name, p_guest_phone, p_memo, p_guest_id, 'link', p_access_token_hash
  );
end;
$$;

revoke all on function public.create_booking(uuid, date, text, integer, integer, text, text, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.create_booking_by_slug(text, date, text, integer, integer, text, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.create_booking(uuid, date, text, integer, integer, text, text, text, uuid, text, text) to service_role;
grant execute on function public.create_booking_by_slug(text, date, text, integer, integer, text, text, text, uuid, text) to service_role;

-- ------------------------------------------------------------
-- 5. 상태 변경 · 환불 처리 RPC (이력은 트리거가 기록)
-- ------------------------------------------------------------
create or replace function public.set_booking_status(
  p_booking_id uuid,
  p_status     text,
  p_reason     text default null,
  p_actor      text default 'host',
  p_actor_id   uuid default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_next_expires timestamptz;
begin
  if p_status not in ('pending', 'confirmed', 'cancelled') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  perform set_config('app.actor', coalesce(p_actor, 'host'), true);
  if p_actor_id is not null then
    perform set_config('app.actor_id', p_actor_id::text, true);
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  if v_booking.id is null then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_booking.source = 'block' then
    raise exception 'BLOCK_BOOKING' using errcode = 'P0001';
  end if;

  v_next_expires := case when p_status = 'pending' then now() + interval '15 minutes' else null end;

  update public.bookings
     set status = p_status,
         cancel_reason = case
           when p_status = 'cancelled' then
             case
               when p_reason in ('expired', 'host', 'guest') then p_reason
               when p_actor = 'guest' then 'guest'
               else 'host'
             end
           else null
         end,
         expires_at = v_next_expires,
         refund_status = case
           when p_status = 'cancelled' and status = 'confirmed' and refund_status = 'none' then 'pending'
           when p_status = 'confirmed' then refund_status
           else refund_status
         end
   where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function public.set_booking_status(uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.set_booking_status(uuid, text, text, text, uuid) to service_role;

create or replace function public.set_refund_status(
  p_booking_id   uuid,
  p_refund_status text,
  p_actor        text default 'host',
  p_actor_id     uuid default null,
  p_memo         text default ''
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
begin
  if p_refund_status not in ('none', 'pending', 'completed') then
    raise exception 'INVALID_REFUND_STATUS' using errcode = 'P0001';
  end if;

  perform set_config('app.actor', coalesce(p_actor, 'host'), true);
  if p_actor_id is not null then
    perform set_config('app.actor_id', p_actor_id::text, true);
  end if;

  update public.bookings
     set refund_status = p_refund_status
   where id = p_booking_id
     and source = 'guest'
  returning * into v_booking;

  if v_booking.id is null then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0001';
  end if;

  if coalesce(btrim(p_memo), '') <> '' then
    insert into public.booking_events (booking_id, event_type, from_status, to_status, actor, actor_id, memo)
    values (v_booking.id, 'refund_memo', v_booking.status, v_booking.status, coalesce(p_actor, 'host'), p_actor_id, btrim(p_memo));
  end if;

  return v_booking;
end;
$$;

revoke all on function public.set_refund_status(uuid, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.set_refund_status(uuid, text, text, uuid, text) to service_role;

-- ------------------------------------------------------------
-- 6. 만료 정리 — 이력이 남도록 actor 를 'system' 으로
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
  perform set_config('app.actor', 'system', true);

  update public.bookings b
     set status = 'cancelled',
         cancel_reason = 'expired'
   where b.status = 'pending'
     and b.source = 'guest'
     and (
       (b.expires_at is not null and b.expires_at < now())
       or (b.start_at is not null and b.start_at < now())
     );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.expire_pending_bookings() from public, anon, authenticated;
grant execute on function public.expire_pending_bookings() to service_role;

-- ------------------------------------------------------------
-- 7. 기존 데이터 보정
-- ------------------------------------------------------------
-- 지난 pending 예약 정리 (이력 포함)
select public.expire_pending_bookings();
