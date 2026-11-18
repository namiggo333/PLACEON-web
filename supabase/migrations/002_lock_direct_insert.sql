-- ============================================================
-- 002_lock_direct_insert.sql
-- 예약 생성 경로를 서버 API(/api/bookings → service_role RPC) 하나로 고정한다.
--
-- 001 마이그레이션과 앱 배포가 끝나고, 실서버에서 /api/bookings 로
-- 예약 생성·중복 차단(SLOT_TAKEN)이 정상 동작하는 것을 확인한 뒤 적용합니다.
--
-- 이 파일을 적용하면 브라우저(anon/authenticated 키)에서 public.bookings 로
-- 직접 INSERT 하는 경로가 닫힙니다. 금액을 임의로 넣은 예약을 만들 수 없게 됩니다.
-- ============================================================

-- 1) 브라우저 직접 INSERT 정책 제거
drop policy if exists "bookings_insert_any" on public.bookings;

-- 2) INSERT 권한 자체를 회수 (service_role 은 RPC 로 우회 생성)
revoke insert on table public.bookings from anon, authenticated;

-- 3) 예약 생성 RPC 는 service_role 만 실행 가능
revoke all on function public.create_booking(uuid, date, text, integer, integer, text, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.create_booking_by_slug(text, date, text, integer, integer, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_booking(uuid, date, text, integer, integer, text, text, text, uuid, text) to service_role;
grant execute on function public.create_booking_by_slug(text, date, text, integer, integer, text, text, text, uuid) to service_role;

comment on table public.bookings is
  '예약. 생성은 서버 API(/api/bookings) → create_booking RPC(service_role)로만 가능하며, 같은 공간의 pending/confirmed 예약은 시간이 겹칠 수 없습니다.';
