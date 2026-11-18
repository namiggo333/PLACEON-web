-- ============================================================
-- 이곳저곳 Supabase 스키마
-- Supabase 대시보드 → SQL Editor 에 그대로 붙여넣고 실행하세요.
-- 실행 순서: 1) 테이블  2) RLS 정책  3) 트리거  4) 샘플 데이터
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. 테이블
-- ------------------------------------------------------------

-- 프로필: auth.users 와 1:1 로 연결되는 서비스 프로필
-- (샘플 데이터를 넣을 수 있도록 auth.users 외래키는 걸지 않았습니다.
--  실제 운영에서는 auth.users(id) references 를 추가해도 됩니다.)
create table if not exists public.profiles (
  id uuid primary key,
  email text unique not null,
  name text not null default '',
  role text not null default 'guest' check (role in ('guest', 'host')),
  phone text default '',
  created_at timestamptz not null default now()
);

-- 공간
create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  host_name text not null default '',
  name text not null,
  category text not null check (
    category in ('party', 'kidsroom', 'practice', 'studio', 'meeting', 'kitchen', 'rooftop', 'study')
  ),
  region text not null,
  district text default '',
  address text default '',
  price_per_hour integer not null check (price_per_hour > 0),
  capacity integer not null default 4 check (capacity > 0),
  discount_rate integer not null default 0 check (discount_rate between 0 and 90),
  description text default '',
  amenities text[] not null default '{}',
  rating numeric(2, 1) not null default 0,
  review_count integer not null default 0,
  featured boolean not null default false,
  time_deal boolean not null default false,
  pay_slug text unique not null,
  image_url text,                                   -- 대표 사진 URL (image_urls[0])
  image_urls text[] not null default '{}',          -- 공간 사진 여러 장
  is_hidden boolean not null default false,         -- true 면 손님 화면(홈·검색)에서 숨김
  created_at timestamptz not null default now()
);

-- 이미 운영 중인 프로젝트라면 아래 두 줄만 따로 실행하면 됩니다.
-- alter table public.spaces add column if not exists image_urls text[] not null default '{}';
-- alter table public.spaces add column if not exists is_hidden boolean not null default false;

-- 카테고리에 키즈룸(kidsroom)이 추가된 경우, 운영 중인 DB에는 아래 두 줄을 따로 실행하세요.
-- alter table public.spaces drop constraint if exists spaces_category_check;
-- alter table public.spaces add constraint spaces_category_check check (
--   category in ('party', 'kidsroom', 'practice', 'studio', 'meeting', 'kitchen', 'rooftop', 'study')
-- );

create index if not exists spaces_host_id_idx on public.spaces (host_id);
create index if not exists spaces_category_idx on public.spaces (category);
create index if not exists spaces_region_idx on public.spaces (region);
create index if not exists spaces_pay_slug_idx on public.spaces (pay_slug);

-- 예약
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  space_name text not null,
  host_id uuid not null references public.profiles (id) on delete cascade,
  guest_id uuid,                          -- 비로그인(전용 결제 링크) 예약은 null
  guest_name text not null check (guest_name <> ''),
  guest_phone text not null check (guest_phone <> ''),
  date date not null,
  start_time text not null,
  hours integer not null check (hours between 1 and 24),
  guests integer not null default 1 check (guests > 0),
  total_amount integer not null check (total_amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  memo text default '',
  source text not null default 'web' check (source in ('web', 'link')),
  start_at timestamptz,                   -- date + start_time (Asia/Seoul). 트리거가 자동 계산
  end_at timestamptz,                     -- start_at + hours. 트리거가 자동 계산
  expires_at timestamptz,                 -- pending 임시 점유 만료 시각
  created_at timestamptz not null default now()
);

create index if not exists bookings_host_id_idx on public.bookings (host_id);
create index if not exists bookings_guest_id_idx on public.bookings (guest_id);
create index if not exists bookings_space_id_idx on public.bookings (space_id);
create index if not exists bookings_start_at_idx on public.bookings (start_at);

-- ------------------------------------------------------------
-- 2. RLS (행 수준 보안)
-- ------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.bookings enable row level security;

-- 프로필: 내 것만 읽고/수정
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- 공간: 누구나 조회, 사장님은 내 공간만 등록·수정·삭제
drop policy if exists "spaces_select_all" on public.spaces;
create policy "spaces_select_all"
  on public.spaces for select
  using (true);

drop policy if exists "spaces_insert_host" on public.spaces;
create policy "spaces_insert_host"
  on public.spaces for insert
  with check (host_id = auth.uid());

drop policy if exists "spaces_update_host" on public.spaces;
create policy "spaces_update_host"
  on public.spaces for update
  using (host_id = auth.uid())
  with check (host_id = auth.uid());

drop policy if exists "spaces_delete_host" on public.spaces;
create policy "spaces_delete_host"
  on public.spaces for delete
  using (host_id = auth.uid());

-- 예약: 게스트는 내 예약, 사장님은 내 공간으로 들어온 예약만 조회
drop policy if exists "bookings_select_participants" on public.bookings;
create policy "bookings_select_participants"
  on public.bookings for select
  using (guest_id = auth.uid() or host_id = auth.uid());

-- 예약 신청: 모든 예약은 서버 API(/api/bookings) → create_booking RPC(service_role)로만 만든다.
-- 브라우저에서 bookings 로 직접 INSERT 하는 경로는 정식 오픈 전에 닫았습니다(002_lock_direct_insert.sql).
-- 아래 정책을 되살리면 anon/authenticated 가 금액을 임의로 넣고 예약을 만들 수 있으니 주의하세요.
-- create policy "bookings_insert_any" on public.bookings for insert
--   with check (guest_id is null or guest_id = auth.uid());

-- 예약 상태 변경: 사장님은 내 예약 승인/거절, 게스트는 내 예약 취소
drop policy if exists "bookings_update_host" on public.bookings;
create policy "bookings_update_host"
  on public.bookings for update
  using (host_id = auth.uid())
  with check (host_id = auth.uid());

drop policy if exists "bookings_update_guest" on public.bookings;
create policy "bookings_update_guest"
  on public.bookings for update
  using (guest_id = auth.uid())
  with check (guest_id = auth.uid());

-- 참고: 위 정책은 상태 변경 권한만 구분합니다. 결제 금액·날짜 등 민감한 값의
-- 변경을 막으려면 Supabase Edge Function(RPC)에서 서버 검증을 추가하세요.

-- ------------------------------------------------------------
-- 3. 공간 사진 저장소 (Supabase Storage)
--    - 공개 버킷(space-images): 누구나 사진 읽기 가능
--    - 로그인한 사장님만 업로드, 올린 본인만 수정·삭제
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'space-images',
  'space-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "space_images_public_read" on storage.objects;
create policy "space_images_public_read"
  on storage.objects for select
  using (bucket_id = 'space-images');

drop policy if exists "space_images_auth_insert" on storage.objects;
create policy "space_images_auth_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'space-images');

drop policy if exists "space_images_auth_update" on storage.objects;
create policy "space_images_auth_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'space-images' and owner = auth.uid())
  with check (bucket_id = 'space-images');

drop policy if exists "space_images_auth_delete" on storage.objects;
create policy "space_images_auth_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'space-images' and owner = auth.uid());

-- ------------------------------------------------------------
-- 4. 회원가입 시 프로필 자동 생성 트리거
-- ------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role, phone)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1)),
    case when new.raw_user_meta_data ->> 'role' = 'host' then 'host' else 'guest' end,
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 5. 샘플 데이터 (선택)
--    - 앱은 샘플 데이터 없이도 바로 동작합니다.
--    - 로그인 계정으로 등록한 공간은 사장님 센터에 자동으로 나타납니다.
-- ------------------------------------------------------------

insert into public.profiles (id, email, name, role, phone) values
  ('b1b1b1b1-1111-4111-8111-b1b1b1b1b1b1', 'host@placeon.kr', '김사장', 'host', '010-2455-7788'),
  ('c2c2c2c2-2222-4222-8222-c2c2c2c2c2c2', 'hello@placeon.kr', '이대표', 'host', '010-3311-2200')
on conflict (id) do nothing;

insert into public.spaces (
  id, host_id, host_name, name, category, region, district, address,
  price_per_hour, capacity, discount_rate, description, amenities,
  rating, review_count, featured, time_deal, pay_slug
) values
  (
    '11111111-1111-4111-8111-000000000001',
    'b1b1b1b1-1111-4111-8111-b1b1b1b1b1b1',
    '김사장',
    '성수 루프탑 라운지',
    'rooftop', '서울', '성동구', '서울 성동구 성수이로 118, 5층 루프탑',
    38000, 20, 20,
    '성수동 골목 위, 하늘이 그대로 열린 루프탑 라운지예요. 해 질 무렵 조명이 켜지면 서울숲 야경이 한눈에 들어옵니다.',
    array['와이파이', '블루투스 스피커', '빔프로젝터', '야외 테이블', '무드등', '주차 2대'],
    4.9, 132, true, true, 'rooftop-seongsu'
  ),
  (
    '11111111-1111-4111-8111-000000000002',
    'c2c2c2c2-2222-4222-8222-c2c2c2c2c2c2',
    '이대표',
    '홍대 파티룸 블룸',
    'party', '서울', '마포구', '서울 마포구 와우산로 62, 3층',
    45000, 15, 15,
    '홍대입구역 3분, 분홍빛 조명과 벨벳 소파가 가득한 파티룸이에요. 노래방 기기와 간이 주방을 갖추고 있습니다.',
    array['와이파이', '노래방', '75인치 TV', '간이 주방', '냉장고', '화장실 2개'],
    4.8, 208, true, false, 'party-hongdae'
  ),
  (
    '11111111-1111-4111-8111-000000000003',
    'c2c2c2c2-2222-4222-8222-c2c2c2c2c2c2',
    '이대표',
    '연남 감성 촬영 스튜디오',
    'studio', '서울', '마포구', '서울 마포구 동교로 254, 2층',
    55000, 8, 0,
    '자연광이 오래 머무는 연남동 스튜디오예요. 화이트·베이지 톤 배경지와 원목 가구, 빈티지 소품이 준비되어 있습니다.',
    array['자연광', '조명 2대', '배경지', '옷걸이 랙', '와이파이', '탈의실'],
    4.9, 87, false, false, 'studio-yeonnam'
  ),
  (
    '11111111-1111-4111-8111-000000000004',
    'c2c2c2c2-2222-4222-8222-c2c2c2c2c2c2',
    '이대표',
    '강남 프라이빗 회의실 A',
    'meeting', '서울', '강남구', '서울 강남구 테헤란로 152, 12층',
    30000, 10, 10,
    '역삼역 2번 출구 앞 조용한 회의실이에요. 10명 회의 테이블과 4K 화면, 화상회의 장비를 갖추고 있습니다.',
    array['화상회의', '4K 모니터', '화이트보드', '와이파이', '정수기', '주차'],
    4.7, 64, false, false, 'meeting-gangnam'
  )
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 5-1. 예약 무결성: 더블부킹 방지 + 서버 금액 재계산
--      (자세한 내용은 supabase/migrations/001_booking_integrity.sql)
-- ------------------------------------------------------------

create extension if not exists btree_gist;

-- 기존 INSERT 호환: date/start_time/hours 만 넣어도 start_at·end_at·expires_at 을 채운다.
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

-- 서버 금액 계산 (spaces 의 시간당 요금·할인율 기준)
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

-- RPC 실행 권한: 서버(service_role)만
revoke all on function public.calc_booking_amount(uuid, integer) from public;
revoke all on function public.create_booking(uuid, date, text, integer, integer, text, text, text, uuid, text) from public;
revoke all on function public.create_booking_by_slug(text, date, text, integer, integer, text, text, text, uuid) from public;
grant execute on function public.calc_booking_amount(uuid, integer) to service_role;
grant execute on function public.create_booking(uuid, date, text, integer, integer, text, text, text, uuid, text) to service_role;
grant execute on function public.create_booking_by_slug(text, date, text, integer, integer, text, text, text, uuid) to service_role;

-- ------------------------------------------------------------
-- 6. 총괄 관리자 (/admin)
--    - 관리자 이메일 명단은 public.admins 에 두고, RLS 정책을 만들지 않아
--      anon/authenticated 키로는 직접 읽을 수 없습니다. (service_role 만 접근)
--    - 화면 접근 제한은 프론트엔드(src/lib/admin.ts)에서 한 번 더 확인합니다.
-- ------------------------------------------------------------

create table if not exists public.admins (
  email text primary key,
  label text not null default '',
  created_at timestamptz not null default now()
);

comment on table public.admins is
  '이곳저곳 총괄 관리자 이메일 명단. is_admin() 함수로만 참조하며 anon/authenticated 직접 조회는 막혀 있습니다.';

alter table public.admins enable row level security;
revoke all on table public.admins from anon, authenticated;

insert into public.admins (email, label) values
  ('namiggo333@gmail.com', '이곳저곳 총괄 관리자')
on conflict (email) do nothing;

-- 현재 로그인한 사용자가 총괄 관리자인지 판별 (JWT 의 email 기준)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 프로필: 관리자는 전체 회원 조회
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

-- 공간: 관리자는 사장님 소유와 관계없이 모든 공간 수정·삭제
drop policy if exists "spaces_update_admin" on public.spaces;
create policy "spaces_update_admin"
  on public.spaces for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "spaces_delete_admin" on public.spaces;
create policy "spaces_delete_admin"
  on public.spaces for delete
  to authenticated
  using (public.is_admin());

-- 예약: 관리자는 전체 예약 조회·상태 변경
drop policy if exists "bookings_select_admin" on public.bookings;
create policy "bookings_select_admin"
  on public.bookings for select
  to authenticated
  using (public.is_admin());

drop policy if exists "bookings_update_admin" on public.bookings;
create policy "bookings_update_admin"
  on public.bookings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
