"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { BookingConsent } from "@/components/ConsentCheckbox";
import { DateStrip, GuestStepper, HoursStepper, SlotGrid } from "@/components/BookingPicker";
import { DepositGuide } from "@/components/DepositGuide";
import { SpaceCard, SpaceMedia } from "@/components/SpaceCard";
import { MascotAvatar } from "@/components/Logo";
import {
  ArrowLeftIcon,
  BoltIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  LinkIcon,
  PinIcon,
  SparkleIcon,
  UsersIcon,
} from "@/components/Icons";
import { APPROVAL_LABEL, CATEGORY_MAP, HOUR_OPTIONS, REVIEWS_ENABLED, TIME_SLOTS } from "@/lib/constants";
import { buildSlotStatuses, fetchOccupiedSlots, type SlotStatus } from "@/lib/availability";
import { calcTotal, cn, formatDate, formatTime, shortId, timeRange, todayISO, won } from "@/lib/format";
import { SITE_URL } from "@/lib/site-url";
import type { Booking } from "@/lib/types";

export default function SpaceDetailView() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { spaces, ready, user, createBooking, refresh } = useApp();
  const space = spaces.find((item) => item.id === params.id);
  const [date, setDate] = useState(todayISO());
  const [startTime, setStartTime] = useState("18:00");
  const [hours, setHours] = useState(2);
  const [guests, setGuests] = useState(2);
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [memo, setMemo] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Booking | null>(null);
  const [showPayGuide, setShowPayGuide] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [occupied, setOccupied] = useState<SlotStatus[]>([]);
  const [checkingSlots, setCheckingSlots] = useState(false);
  const [origin, setOrigin] = useState(SITE_URL);
  const formRef = useRef<HTMLFormElement | null>(null);
  const slotRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (user) {
      setName((value) => value || user.name);
      setPhone((value) => value || user.phone);
    }
  }, [user]);

  useEffect(() => {
    if (!space) return;
    let alive = true;
    setCheckingSlots(true);
    const from = date;
    const to = date;
    fetchOccupiedSlots(space.id, from, to)
      .then((list) => {
        if (!alive) return;
        const statuses = buildSlotStatuses(date, TIME_SLOTS, hours, list);
        setOccupied(statuses);
        // 지난 시간이나 이미 찬 시간이 기본값으로 잡혀 있으면 가장 가까운 예약 가능 시간으로 옮긴다.
        setStartTime((current) => {
          const picked = statuses.find((entry) => entry.start === current);
          if (picked && !picked.taken && !picked.past) return current;
          const firstFree = statuses.find((entry) => !entry.taken && !entry.past);
          return firstFree ? firstFree.start : current;
        });
      })
      .finally(() => {
        if (alive) setCheckingSlots(false);
      });
    return () => {
      alive = false;
    };
  }, [space?.id, date, hours]);

  const similar = useMemo(
    () => spaces.filter((item) => item.id !== space?.id && item.category === space?.category).slice(0, 4),
    [spaces, space]
  );

  if (!ready) {
    return (
      <div className="container-page py-10">
        <div className="skeleton h-8 w-52" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="skeleton aspect-[16/9] w-full" />
          <div className="skeleton h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!space) {
    return (
      <div className="container-page py-20 text-center">
        <MascotAvatar size={84} className="mx-auto" />
        <h1 className="mt-3 text-xl font-extrabold">공간을 찾을 수 없어요</h1>
        <p className="mt-1 text-sm text-ink-mute">주소가 바뀌었거나 삭제된 공간이에요.</p>
        <Link href="/" className="btn-primary mt-5">
          홈으로 가기
        </Link>
      </div>
    );
  }

  const category = CATEGORY_MAP[space.category];
  const subtotal = space.pricePerHour * hours;
  const total = calcTotal(space.pricePerHour, hours, space.discountRate);
  const discount = subtotal - total;
  const photos = space.imageUrls ?? [];
  const safePhotoIndex = photos.length > 0 ? Math.min(photoIndex, photos.length - 1) : 0;
  const selectedSlot = occupied.find((slot) => slot.start === startTime);
  const slotReady = Boolean(selectedSlot && !selectedSlot.taken && !selectedSlot.past);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!space) return;
    setError("");
    if (!user) {
      router.push(`/auth?next=${encodeURIComponent(`/spaces/${space.id}`)}`);
      return;
    }
    if (!name.trim()) return setError("예약자 이름을 입력해 주세요.");
    if (!phone.trim()) return setError("연락처를 입력해 주세요.");
    if (guests > space.capacity) return setError(`이 공간은 최대 ${space.capacity}명까지 이용할 수 있어요.`);
    const picked = occupied.find((slot) => slot.start === startTime);
    if (picked?.taken) return setError("선택한 시간대는 이미 예약(또는 사장님 차단)되어 있어요. 다른 시간을 골라 주세요.");
    if (picked?.past) return setError("지난 시간은 예약할 수 없어요. 다른 시간을 골라 주세요.");
    if (!agreed) return setError("이용약관과 취소·환불 규정에 먼저 동의해 주세요.");
    setSubmitting(true);
    try {
      const booking = await createBooking({
        space,
        date,
        startTime,
        hours,
        guests,
        guestName: name.trim(),
        guestPhone: phone.trim(),
        memo,
        channel: "web",
      });
      setDone(booking);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "예약 신청에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleCta() {
    if (!slotReady) {
      slotRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    formRef.current?.requestSubmit();
  }

  const ctaLabel = !slotReady
    ? "시간을 선택해 주세요"
    : submitting
      ? "예약 신청 중…"
      : "예약 신청하기";

  return (
    <div className="container-page py-5 has-ui-cta-bar sm:py-8 md:pb-8">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-4 inline-flex items-center gap-1 text-[13px] font-semibold text-ink-mute hover:text-brand-dark"
      >
        <ArrowLeftIcon size={15} />
        돌아가기
      </button>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)] lg:items-start lg:gap-8">
        {/* ── 1. 사진 · 이름 · 가격 ─────────────────────────────── */}
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <div className="overflow-hidden rounded-xl2 border border-ink-line">
            <div className="aspect-[4/3] w-full sm:aspect-[16/9]">
              <SpaceMedia
                space={
                  photos.length > 0
                    ? { ...space, imageUrls: [photos[safePhotoIndex]], imageUrl: photos[safePhotoIndex] }
                    : space
                }
                emojiSize="text-7xl"
              />
            </div>
            {photos.length > 1 && (
              <div className="no-scrollbar flex gap-2 overflow-x-auto border-t border-ink-line bg-white p-2">
                {photos.map((url, index) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setPhotoIndex(index)}
                    className={cn(
                      "relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition",
                      index === safePhotoIndex
                        ? "border-brand"
                        : "border-transparent opacity-75 hover:opacity-100"
                    )}
                    aria-label={`사진 ${index + 1} 보기`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {space.approvalStatus !== "approved" && (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] font-medium leading-relaxed text-amber-800">
              <span className="shrink-0">🛡️</span>
              <span>
                {APPROVAL_LABEL[space.approvalStatus]} 상태예요. 관리자 확인이 끝나기 전에는 손님 화면에 노출되지
                않고 예약도 받을 수 없어요.
                {space.rejectionReason ? ` (반려 사유: ${space.rejectionReason})` : ""}
              </span>
            </p>
          )}

          {space.hidden && (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] font-medium leading-relaxed text-amber-800">
              <span className="shrink-0">🔒</span>
              지금은 비공개로 설정된 공간이에요. 사장님에게만 보이고, 손님 화면(홈·검색)에는 노출되지 않아요.
            </p>
          )}

          <div className="mt-5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="ui-badge ui-badge--closed bg-white text-ink-soft ring-1 ring-ink-line">
                {category.emoji} {category.label}
              </span>
              {space.featured && <span className="ui-badge bg-ink text-white">광고</span>}
              {space.timeDeal && space.discountRate > 0 && (
                <span className="ui-badge ui-badge--deal">타임특가 {space.discountRate}%</span>
              )}
            </div>
            <h1 className="mt-2.5 text-[24px] font-extrabold leading-snug tracking-tight text-ink sm:text-[30px]">
              {space.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-ink-soft">
              <span className="inline-flex items-center gap-1">
                <PinIcon size={14} className="text-ink-mute" />
                {[space.region, space.district].filter(Boolean).join(" ") || "위치는 예약 확정 후 안내"}
              </span>
              <span className="inline-flex items-center gap-1">
                <UsersIcon size={14} className="text-ink-mute" />
                최대 {space.capacity}명
              </span>
              {REVIEWS_ENABLED && space.reviewCount > 0 && (
                <span className="inline-flex items-center gap-1">★ {space.rating.toFixed(1)} ({space.reviewCount})</span>
              )}
            </div>

            <div className="ui-price-row mt-3 rounded-2xl bg-brand-light/60 px-3.5 py-3">
              {space.discountRate > 0 && <span className="ui-price-rate">{space.discountRate}%</span>}
              <span className="ui-price-main">{won(Math.round((space.pricePerHour * (100 - space.discountRate)) / 100))}</span>
              <span className="ui-price-unit">/시간</span>
              {space.discountRate > 0 && <span className="ui-price-orig">{won(space.pricePerHour)}</span>}
            </div>
          </div>
        </div>

        {/* ── 2. 예약 (모바일에서는 사진 바로 아래, 데스크톱에서는 오른쪽 고정) ── */}
        <aside
          id="booking"
          className="scroll-mt-20 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1"
        >
          {done ? (
            <div className="card animate-pop-in p-5">
              <div className="flex flex-col items-center text-center">
                <span className="relative">
                  <MascotAvatar size={76} />
                  <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-emerald-500 text-white ring-2 ring-white">
                    <CheckIcon size={14} />
                  </span>
                </span>
                <h2 className="mt-3 text-lg font-extrabold text-ink">예약 신청 완료!</h2>
                <p className="mt-1 text-[13px] text-ink-mute">
                  아래 계좌로 입금하고 <b className="text-ink">입금했어요</b>를 눌러 주세요.
                  <br />
                  예약번호 {shortId(done.id)}
                </p>
              </div>

              <dl className="mt-4 space-y-2 rounded-xl bg-ink-line/30 p-3.5 text-[13px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-mute">공간</dt>
                  <dd className="text-right font-semibold text-ink">{done.spaceName}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-mute">일시</dt>
                  <dd className="text-right font-semibold text-ink">
                    {formatDate(done.date)} {timeRange(done.startTime, done.hours)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-mute">인원</dt>
                  <dd className="text-right font-semibold text-ink">{done.guests}명 · {done.hours}시간</dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-ink-line pt-2">
                  <dt className="font-semibold text-ink">이용 요금</dt>
                  <dd className="text-right text-sm font-extrabold text-brand-dark">{won(done.totalAmount)}</dd>
                </div>
              </dl>

              <DepositGuide booking={done} className="mt-3" token={done.accessToken} />

              {done.accessToken && (
                <div className="mt-3 rounded-xl border border-ink-line bg-ink-line/20 p-3 text-[12px] leading-relaxed text-ink-soft">
                  <p className="font-bold text-ink">비로그인 예약 확인 링크</p>
                  <p className="mt-1 break-all">
                    {origin}/bookings?booking={done.id}&amp;token={done.accessToken}
                  </p>
                  <p className="mt-1 text-ink-mute">
                    이 링크로 예약 상태를 확인하고, 입금이 확인되면 상세주소·출입 안내를 볼 수 있어요. 링크를 꼭
                    보관해 주세요.
                  </p>
                </div>
              )}

              <div className="mt-3 flex flex-col gap-2">
                {(done.accessToken || user) && (
                  <Link
                    href={done.accessToken ? `/bookings?booking=${done.id}&token=${done.accessToken}` : "/bookings"}
                    className="btn-primary w-full"
                  >
                    예약 내역 보기
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setShowPayGuide((value) => !value)}
                  className="btn-ghost w-full"
                >
                  <LinkIcon size={15} />
                  호스트 결제 링크 안내
                </button>
                {showPayGuide && (
                  <div className="rounded-xl bg-brand-light p-3 text-[12px] leading-relaxed text-ink-soft">
                    이 공간의 전용 결제 링크로 이동하면 같은 예약을 링크로도 받을 수 있어요.
                    <Link
                      href={`/pay/${space.paySlug}`}
                      className="mt-2 flex items-center justify-center gap-1 rounded-lg bg-white px-3 py-2 font-bold text-brand-dark"
                    >
                      <LinkIcon size={13} />
                      /pay/{space.paySlug}
                    </Link>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setDone(null);
                    setShowPayGuide(false);
                    void refresh().catch(() => {});
                  }}
                  className="text-[13px] font-semibold text-ink-mute hover:text-brand-dark"
                >
                  다른 시간으로 예약하기
                </button>
              </div>
            </div>
          ) : (
            <form ref={formRef} onSubmit={submit} className="card p-4 sm:p-5">
              <div className="flex items-baseline justify-between">
                <div className="ui-price-row">
                  {space.discountRate > 0 && (
                    <span className="ui-price-rate">{space.discountRate}%</span>
                  )}
                  <span className="ui-price-main">{won(total)}</span>
                  <span className="ui-price-unit">/ {hours}시간</span>
                </div>
                {space.discountRate > 0 && <span className="ui-price-orig">{won(subtotal)}</span>}
              </div>
              <p className="mt-1 text-[12px] text-ink-mute">시간당 {won(space.pricePerHour)} · 최대 {space.capacity}명</p>

              <div className="mt-4 space-y-4">
                <div>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="text-[13px] font-semibold text-ink-soft">이용 날짜</span>
                    <span className="text-[12px] text-ink-mute">{formatDate(date)}</span>
                  </div>
                  <DateStrip value={date} onChange={setDate} />
                  <label className="mt-1 flex items-center gap-2 text-[12px] text-ink-mute">
                    <CalendarIcon size={13} />
                    다른 날짜
                    <input
                      type="date"
                      min={todayISO()}
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      className="rounded-lg border border-ink-line px-2 py-1 text-[13px] text-ink"
                      aria-label="다른 날짜 선택"
                    />
                  </label>
                </div>

                <div ref={slotRef}>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="text-[13px] font-semibold text-ink-soft">시작 시간</span>
                    <span className="text-[12px] font-semibold text-brand-strong">
                      {checkingSlots ? "확인 중…" : timeRange(startTime, hours)}
                    </span>
                  </div>
                  <SlotGrid statuses={occupied} value={startTime} hours={hours} onChange={setStartTime} />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">이용 시간</span>
                    <HoursStepper value={hours} options={HOUR_OPTIONS} onChange={setHours} />
                  </div>
                  <div>
                    <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">인원</span>
                    <GuestStepper value={guests} max={space.capacity} onChange={setGuests} />
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="name">
                      예약자
                    </label>
                    <input
                      id="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="이름"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="phone">
                      연락처
                    </label>
                    <input
                      id="phone"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="010-0000-0000"
                      className="input"
                      inputMode="tel"
                    />
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="memo">
                    요청 사항 (선택)
                  </label>
                  <textarea
                    id="memo"
                    value={memo}
                    onChange={(event) => setMemo(event.target.value)}
                    rows={2}
                    placeholder="세팅 요청, 사용 목적 등을 적어주세요"
                    className="input resize-none"
                  />
                </div>

                <div className="rounded-xl bg-ink-line/30 p-3 text-[13px]">
                  <div className="flex justify-between text-ink-soft">
                    <span>
                      {won(space.pricePerHour)} × {hours}시간
                    </span>
                    <span>{won(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="mt-1 flex justify-between text-brand-dark">
                      <span>타임특가 {space.discountRate}% 할인</span>
                      <span>−{won(discount)}</span>
                    </div>
                  )}
                  <div className="mt-1.5 flex items-baseline justify-between border-t border-ink-line pt-1.5">
                    <span className="font-bold text-ink">총 금액</span>
                    <span className="text-[24px] font-extrabold leading-none text-ink">{won(total)}</span>
                  </div>
                  <p className="mt-1 text-[12px] text-ink-mute">
                    {formatDate(date)} {timeRange(startTime, hours)}
                  </p>
                </div>

                <BookingConsent checked={agreed} onChange={setAgreed} id="space-booking-consent" />

                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600">{error}</p>
                )}

                <button type="submit" disabled={submitting} className="btn-primary w-full py-3.5 text-[16px]">
                  <BoltIcon size={16} />
                  {submitting ? "예약 신청 중…" : user ? "예약 신청하기" : "로그인하고 예약하기"}
                </button>
                <p className="text-center text-[12px] leading-relaxed text-ink-mute">
                  예약 신청 후 15분 안에 안내된 계좌로 입금하고 [입금했어요]를 누르면 사장님 확인을 거쳐 확정돼요.
                </p>
              </div>
            </form>
          )}
        </aside>

        {/* ── 3. 소개 · 시설 · 안내 · 호스트 ───────────────────── */}
        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          <section className="border-t border-ink-line pt-6">
            <h2 className="text-[17px] font-bold text-ink sm:text-[19px]">공간 소개</h2>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">{space.description}</p>
          </section>

          <section className="mt-7 border-t border-ink-line pt-6">
            <h2 className="text-[17px] font-bold text-ink sm:text-[19px]">제공 시설</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {space.amenities.map((amenity) => (
                <span
                  key={amenity}
                  className="inline-flex items-center gap-1 rounded-lg bg-brand-light/70 px-2.5 py-1.5 text-[13px] font-medium text-ink-soft"
                >
                  <CheckIcon size={13} className="text-brand-dark" />
                  {amenity}
                </span>
              ))}
            </div>
          </section>

          <section className="mt-7 border-t border-ink-line pt-6">
            <h2 className="text-[17px] font-bold text-ink sm:text-[19px]">이용 안내</h2>
            <ul className="mt-2 space-y-1.5 text-[15px] leading-relaxed text-ink-soft">
              <li>· 예약 신청 후 15분 안에 사장님 계좌로 입금하고 [입금했어요]를 눌러 주세요.</li>
              <li>· 입금 신호를 누르면 예약이 바로 풀리지 않고, 사장님이 확인할 때까지 유지돼요.</li>
              <li>· 사장님이 입금을 확인하면 예약이 확정되고 메일로 안내드려요.</li>
              <li>· 이용 시작 20분 전까지 도착해 주시면 세팅 시간을 드릴 수 있어요.</li>
              <li>· 이용 3일 전까지 무료 취소, 이후에는 사장님과 협의가 필요해요.</li>
            </ul>
          </section>

          <section className="mt-7 border-t border-ink-line pt-6">
            <h2 className="text-[17px] font-bold text-ink sm:text-[19px]">호스트</h2>
            <div className="mt-3 flex items-center justify-between rounded-xl2 border border-ink-line bg-white p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-light text-base font-extrabold text-brand-dark">
                  {space.hostName.slice(0, 1)}
                </span>
                <div>
                  <p className="text-sm font-bold text-ink">{space.hostName}</p>
                  <p className="text-[12px] text-ink-mute">이곳저곳 호스트</p>
                </div>
              </div>
              <span className="ui-badge ui-badge--deal">
                <SparkleIcon size={12} />
                전용 예약 링크 운영
              </span>
            </div>
          </section>

          {similar.length > 0 && (
            <section className="mt-8 border-t border-ink-line pt-6">
              <h2 className="text-[17px] font-bold text-ink sm:text-[19px]">비슷한 공간</h2>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {similar.slice(0, 2).map((item) => (
                  <SpaceCard key={item.id} space={item} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* 하단 고정 CTA — 합계와 지금 해야 할 일을 한 줄로 */}
      {!done && (
        <div className="ui-cta-bar md:hidden">
          <div className="ui-cta-sum">
            <small>
              {slotReady
                ? `${formatDate(date)} ${timeRange(startTime, hours)} · ${hours}시간`
                : "날짜와 시간을 골라 주세요"}
            </small>
            <strong>{won(total)}</strong>
          </div>
          <button
            type="button"
            onClick={handleCta}
            disabled={submitting}
            className="ui-cta-btn"
          >
            {ctaLabel}
          </button>
        </div>
      )}
    </div>
  );
}
