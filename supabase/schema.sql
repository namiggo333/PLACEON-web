-- ============================================================
-- 플레이스온(PlaceOn) Supabase 스키마
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
  created_at timestamptz not null default now()
);

create index if not exists bookings_host_id_idx on public.bookings (host_id);
create index if not exists bookings_guest_id_idx on public.bookings (guest_id);
create index if not exists bookings_space_id_idx on public.bookings (space_id);

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

-- 예약 신청: 로그인 손님은 본인 id 로, 비로그인 손님(전용 결제 링크)은 guest_id null 로
drop policy if exists "bookings_insert_any" on public.bookings;
create policy "bookings_insert_any"
  on public.bookings for insert
  with check (guest_id is null or guest_id = auth.uid());

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
