"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { BookingConsent } from "@/components/ConsentCheckbox";
import { DateStrip, GuestStepper, HoursStepper, SlotGrid } from "@/components/BookingPicker";
import { DepositGuide } from "@/components/DepositGuide";
import { LogoMark, MascotAvatar } from "@/components/Logo";
import { SpaceMedia } from "@/components/SpaceCard";
import {
  ArrowLeftIcon,
  BoltIcon,
  CalendarIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  PinIcon,
  SparkleIcon,
  StarIcon,
  UsersIcon,
} from "@/components/Icons";
import { APPROVAL_LABEL, CATEGORY_MAP, HOUR_OPTIONS, REVIEWS_ENABLED, TIME_SLOTS } from "@/lib/constants";
import { buildSlotStatuses, fetchOccupiedSlots, type SlotStatus } from "@/lib/availability";
import { calcTotal, cn, formatDate, shortId, timeRange, todayISO, won } from "@/lib/format";
import { SITE_URL } from "@/lib/site-url";
import type { Booking, Space } from "@/lib/types";

/** 공간 사진 갤러리 — 대표 사진 + 썸네일 (여러 장이면 넘겨 보기) */
function PhotoGallery({ space }: { space: Space }) {
  const photos = space.imageUrls?.length ? space.imageUrls : [];
  const [index, setIndex] = useState(0);
  const category = CATEGORY_MAP[space.category] ?? CATEGORY_MAP.party;
  const safeIndex = photos.length ? Math.min(index, photos.length - 1) : 0;

  return (
    <div>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl3 bg-ink-line/40 shadow-card sm:aspect-[16/10]">
        {photos.length ? (
          <Image
            src={photos[safeIndex]}
            alt={`${space.name} 사진 ${safeIndex + 1}`}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 620px"
            className="object-cover"
          />
        ) : (
          <SpaceMedia space={space} emojiSize="text-7xl" />
        )}

        {photos.length === 0 && (
          <span className="absolute bottom-3 left-3 rounded-full bg-white/85 px-2.5 py-1 text-[12px] font-bold text-ink-soft backdrop-blur">
            사장님이 공간 사진을 준비하고 있어요
          </span>
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/25 to-transparent" />
        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
          <span className="badge bg-white/90 text-brand-deep backdrop-blur">
            {category.emoji} {category.label}
          </span>
          {space.discountRate > 0 && (
            <span className="badge bg-brand text-white shadow-sm">타임특가 {space.discountRate}%</span>
          )}
        </div>

        {photos.length > 1 && (
          <>
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent" />
            <div className="absolute bottom-3 right-3 rounded-full bg-ink/60 px-2.5 py-0.5 text-[12px] font-bold text-white backdrop-blur">
              {safeIndex + 1} / {photos.length}
            </div>
            <button
              type="button"
              aria-label="이전 사진"
              onClick={() => setIndex((value) => (value - 1 + photos.length) % photos.length)}
              className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink shadow-card backdrop-blur transition hover:bg-white sm:grid"
            >
              <ArrowLeftIcon size={18} />
            </button>
            <button
              type="button"
              aria-label="다음 사진"
              onClick={() => setIndex((value) => (value + 1) % photos.length)}
              className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink shadow-card backdrop-blur transition hover:bg-white sm:grid"
            >
              <ChevronRightIcon size={18} />
            </button>
          </>
        )}
      </div>

      {photos.length > 1 && (
        <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {photos.map((photo, photoIndex) => (
            <button
              key={`${photo}-${photoIndex}`}
              type="button"
              onClick={() => setIndex(photoIndex)}
              aria-label={`${photoIndex + 1}번째 사진 보기`}
              aria-pressed={photoIndex === safeIndex}
              className={cn(
                "relative h-14 w-14 shrink-0 overflow-hidden rounded-xl ring-2 transition",
                photoIndex === safeIndex ? "ring-brand" : "ring-transparent hover:ring-brand/40"
              )}
            >
              <Image src={photo} alt="" fill sizes="56px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const STEPS = [
  { emoji: "🗓", title: "날짜·시간 선택", desc: "비어 있는 시간대를 골라요" },
  { emoji: "🩷", title: "예약 요청", desc: "로그인 없이 이름·연락처만" },
  { emoji: "✅", title: "입금 → 확정", desc: "입금 신고 후 사장님 확인" },
];

export default function PayView() {
  const params = useParams<{ slug: string }>();
  const { spaces, ready, user, createBooking } = useApp();

  const space =
    spaces.find((item) => item.paySlug === params.slug) ?? spaces.find((item) => item.id === params.slug);

  const [date, setDate] = useState(todayISO());
  const [startTime, setStartTime] = useState("18:00");
  const [hours, setHours] = useState(2);
  const [guests, setGuests] = useState(2);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<Booking | null>(null);
  const [occupied, setOccupied] = useState<SlotStatus[]>([]);
  const [checkingSlots, setCheckingSlots] = useState(false);
  const [origin, setOrigin] = useState(SITE_URL);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!space) return;
    let alive = true;
    setCheckingSlots(true);
    fetchOccupiedSlots(space.id, date, date)
      .then((list) => {
        if (!alive) return;
        const statuses = buildSlotStatuses(date, TIME_SLOTS, hours, list);
        setOccupied(statuses);
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

  useEffect(() => {
    if (user) {
      setName((value) => value || user.name);
      setPhone((value) => value || user.phone);
    }
  }, [user]);

  const subtotal = space ? space.pricePerHour * hours : 0;
  const total = space ? calcTotal(space.pricePerHour, hours, space.discountRate) : 0;
  const discount = subtotal - total;

  if (!ready) {
    return (
      <div className="min-h-dvh bg-brand-light/50 p-4">
        <div className="mx-auto mt-10 max-w-5xl">
          <div className="skeleton h-64 w-full" />
          <div className="mt-4 skeleton h-40 w-full" />
        </div>
      </div>
    );
  }

  if (!space) {
    return (
      <div className="min-h-dvh bg-gradient-to-b from-brand-light via-[#FFF8FB] to-white px-4 py-16">
        <div className="mx-auto max-w-md rounded-xl3 bg-white p-8 text-center shadow-float">
          <MascotAvatar size={80} className="mx-auto" />
          <h1 className="mt-3 text-[20px] text-ink">링크를 찾을 수 없어요</h1>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-mute">
            사장님이 링크를 새로 만들었거나 공간이 삭제되었을 수 있어요. 사장님께 다시 링크를 요청해 주세요.
          </p>
          <Link href="/" className="btn-primary mt-5 w-full">
            이곳저곳 홈으로
          </Link>
        </div>
      </div>
    );
  }

  const category = CATEGORY_MAP[space.category] ?? CATEGORY_MAP.party;
  const discountedPrice = Math.round((space.pricePerHour * (100 - space.discountRate)) / 100);
  const place = [space.region, space.district].filter(Boolean).join(" ").trim() || "위치는 예약 확정 후 안내";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!space) return;
    setError("");
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
        channel: "link",
      });
      setDone(booking);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "예약 신청에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-[linear-gradient(180deg,#FFF0F6_0%,#FFF7FB_38%,#FFFFFF_78%)]">
      {/* 상단 바 — 전용 예약 페이지임을 한눈에 */}
      <header className="sticky top-0 z-40 border-b border-brand/10 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 px-4">
          <Link href="/" className="flex shrink-0 items-center gap-1.5" aria-label="이곳저곳 홈">
            <LogoMark size={28} decorative />
            <span className="font-display text-[21px] leading-none text-ink">이곳저곳</span>
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden items-center gap-1 rounded-full bg-brand-light px-2.5 py-1 text-[12px] font-bold text-brand-dark sm:inline-flex">
              <SparkleIcon size={12} />
              수수료 0원 · 전용 예약 페이지
            </span>
            {!done && (
              <a href="#booking" className="btn-primary btn-sm rounded-full px-3.5 py-1.5 lg:hidden">
                예약하기
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-4 sm:pt-6 md:pb-14">
        {done ? (
          <div className="mx-auto max-w-lg animate-pop-in rounded-xl3 bg-white p-5 shadow-float sm:p-7">
            <div className="flex flex-col items-center text-center">
              <span className="relative">
                <MascotAvatar size={88} />
                <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-emerald-500 text-white ring-2 ring-white">
                  <CheckIcon size={16} />
                </span>
              </span>
              <h1 className="mt-3 text-[22px] text-ink">예약 신청이 접수됐어요</h1>
              <p className="mt-1 text-xs text-ink-mute">
                예약번호 <b className="text-ink">{shortId(done.id)}</b> · 15분 안에 입금하면 예약이 확정돼요.
              </p>
            </div>

            <dl className="mt-5 space-y-2 rounded-2xl bg-[#FFF8FB] p-4 text-xs ring-1 ring-ink-line">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-mute">공간</dt>
                <dd className="text-right font-bold text-ink">{done.spaceName}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-mute">일시</dt>
                <dd className="text-right font-bold text-ink">
                  {formatDate(done.date)} {timeRange(done.startTime, done.hours)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-mute">인원 / 시간</dt>
                <dd className="text-right font-bold text-ink">
                  {done.guests}명 / {done.hours}시간
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-mute">예약자</dt>
                <dd className="text-right font-bold text-ink">
                  {done.guestName} · {done.guestPhone}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-ink-line pt-2">
                <dt className="font-bold text-ink">이용 요금</dt>
                <dd className="text-right text-base text-brand-dark">{won(done.totalAmount)}</dd>
              </div>
            </dl>

            <DepositGuide booking={done} className="mt-3" />

            {done.accessToken && (
              <div className="mt-3 rounded-2xl border border-ink-line bg-[#FFF8FB] p-3 text-[12px] leading-relaxed text-ink-soft">
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

            <div className="mt-4 flex flex-col gap-2">
              {user && (
                <Link href="/bookings" className="btn-primary w-full py-3">
                  예약 내역 보기
                </Link>
              )}
              <Link href="/" className={cn("w-full py-3", user ? "btn-ghost" : "btn-primary")}>
                이곳저곳 둘러보기
              </Link>
            </div>
            {user && (
              <p className="mt-2 text-center text-[12px] leading-relaxed text-ink-mute">
                예약이 확정되면 예약 내역에서 💌 모임 초대 카드를 만들어 친구에게 보낼 수 있어요.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.06fr_0.94fr] lg:items-start lg:gap-7">
            <div className="min-w-0 space-y-4">
              <PhotoGallery space={space} />

              {/* 공간 소개 */}
              <section className="rounded-xl2 bg-white p-4 shadow-card sm:p-5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={cn("badge", category.pastel, category.tone)}>
                    {category.emoji} {category.label}
                  </span>
                  {space.timeDeal && space.discountRate > 0 && (
                    <span className="badge bg-brand-light text-brand-dark">
                      <BoltIcon size={11} /> 지금 타임특가
                    </span>
                  )}
                  <span className="badge bg-ink-line/60 text-ink-soft">
                    <UsersIcon size={11} /> 최대 {space.capacity}명
                  </span>
                  {REVIEWS_ENABLED && space.reviewCount > 0 && (
                    <span className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-ink-soft">
                      <StarIcon size={12} className="text-amber-400" />
                      {space.rating.toFixed(1)} <span className="text-ink-mute">({space.reviewCount})</span>
                    </span>
                  )}
                </div>

                <h1 className="mt-2.5 text-[24px] leading-snug text-ink sm:text-[28px]">{space.name}</h1>
                {space.approvalStatus !== "approved" && (
                  <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[12px] font-semibold leading-relaxed text-amber-800">
                    🛡️ {APPROVAL_LABEL[space.approvalStatus]} 상태의 공간이에요. 관리자 확인이 끝나면 손님에게 열려요.
                  </p>
                )}

                <a
                  href={`https://map.naver.com/p/search/${encodeURIComponent(place)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-ink-soft underline-offset-2 hover:text-brand-dark hover:underline"
                >
                  <PinIcon size={13} className="text-ink-mute" />
                  {place || "위치는 사장님께 문의해 주세요"}
                </a>

                <div className="mt-3 flex flex-wrap items-end gap-x-2 gap-y-1 rounded-2xl bg-[#FFF8FB] px-3.5 py-3 ring-1 ring-ink-line">
                  {space.discountRate > 0 && (
                    <span className="text-[15px] font-extrabold text-brand-dark">{space.discountRate}%</span>
                  )}
                  <span className="num text-[26px] font-extrabold leading-none tracking-[-0.025em] text-ink sm:text-[30px]">{won(discountedPrice)}</span>
                  <span className="text-[12px] font-semibold text-ink-mute">/시간</span>
                  {space.discountRate > 0 && (
                    <span className="text-[12px] font-semibold text-ink-mute line-through">{won(space.pricePerHour)}</span>
                  )}
                  <span className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-ink-soft">
                    <ClockIcon size={12} /> 시간 단위 예약
                  </span>
                </div>

                <div className="mt-3.5">
                  <h2 className="text-[17px] font-bold text-ink">공간 소개</h2>
                  <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-ink-soft">
                    {space.description || "사장님이 공간 소개를 준비하고 있어요."}
                  </p>
                </div>

                {space.amenities.length > 0 && (
                  <div className="mt-3.5">
                    <h2 className="text-[17px] font-bold text-ink">편의시설</h2>
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {space.amenities.map((amenity) => (
                        <li
                          key={amenity}
                          className="inline-flex items-center gap-1 rounded-full bg-ink-line/50 px-2.5 py-1 text-[12px] font-semibold text-ink-soft"
                        >
                          <CheckIcon size={11} className="text-brand-dark" />
                          {amenity}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-3.5 flex items-center gap-2.5 rounded-2xl border border-ink-line px-3 py-2.5">
                  <MascotAvatar size={34} ring={false} />
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-bold text-ink">{space.hostName} 사장님의 공간</p>
                    <p className="truncate text-[12px] text-ink-mute">이곳저곳 전용 예약 페이지로 받는 예약은 수수료 0원</p>
                  </div>
                </div>
              </section>

              {/* 예약 절차 */}
              <section className="rounded-xl2 bg-white p-4 shadow-card sm:p-5">
                <h2 className="text-[17px] font-bold text-ink">이렇게 예약해요</h2>
                <ol className="mt-2.5 grid gap-2 sm:grid-cols-3">
                  {STEPS.map((step, index) => (
                    <li key={step.title} className="relative rounded-2xl bg-[#FFF8FB] px-3 py-2.5 ring-1 ring-ink-line">
                      <span className="text-[15px]" aria-hidden>
                        {step.emoji}
                      </span>
                      <p className="mt-0.5 text-[13px] font-bold text-ink">
                        {index + 1}. {step.title}
                      </p>
                      <p className="text-[12px] text-ink-mute">{step.desc}</p>
                    </li>
                  ))}
                </ol>
                <p className="mt-2.5 flex items-start gap-1.5 rounded-xl bg-brand-light/70 px-3 py-2 text-[12px] font-semibold leading-relaxed text-brand-deep">
                  <SparkleIcon size={13} className="mt-0.5 shrink-0" />
                  인스타·카톡으로 받은 손님도 이 페이지에서 바로 예약할 수 있어요. 중간 수수료 없이 사장님께 그대로
                  전달돼요.
                </p>
              </section>
            </div>

            {/* 예약 폼 */}
            <form
              id="booking"
              ref={formRef}
              onSubmit={submit}
              className="scroll-mt-20 rounded-xl2 border border-brand/10 bg-white p-4 shadow-float sm:p-5 lg:sticky lg:top-[76px]"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-[19px] text-ink">예약하기</h2>
                <span className="badge bg-brand-light text-brand-dark">로그인 없이</span>
              </div>
              <p className="mt-0.5 text-[12px] text-ink-mute">날짜와 시간만 고르면 예약 요청 끝, 입금하면 확정돼요.</p>

              <div className="mt-3.5 space-y-3">
                <div>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="label mb-0">이용 날짜</span>
                    <span className="text-[12px] text-ink-mute">{formatDate(date)}</span>
                  </div>
                  <DateStrip value={date} onChange={setDate} />
                  <label className="mt-1 flex items-center gap-2 text-[12px] text-ink-mute">
                    <CalendarIcon size={13} />
                    다른 날짜
                    <input
                      id="pay-date"
                      type="date"
                      min={todayISO()}
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      className="rounded-lg border border-ink-line px-2 py-1 text-[13px] text-ink"
                      aria-label="이용 날짜"
                      required
                    />
                  </label>
                </div>

                <div id="pay-slots">
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="label mb-0">시작 시간</span>
                    <span className="text-[12px] font-semibold text-brand-strong">
                      {checkingSlots ? "확인 중…" : timeRange(startTime, hours)}
                    </span>
                  </div>
                  <SlotGrid statuses={occupied} value={startTime} hours={hours} onChange={setStartTime} />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <span className="label">이용 시간</span>
                    <HoursStepper value={hours} options={HOUR_OPTIONS} onChange={setHours} />
                  </div>
                  <div>
                    <span className="label">인원 (최대 {space.capacity}명)</span>
                    <GuestStepper value={guests} max={space.capacity} onChange={setGuests} />
                  </div>
                </div>


                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label" htmlFor="pay-name">
                      예약자 이름
                    </label>
                    <input
                      id="pay-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="이름"
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="pay-phone">
                      연락처
                    </label>
                    <input
                      id="pay-phone"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="010-0000-0000"
                      inputMode="tel"
                      className="input"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="pay-memo">
                    요청 사항 (선택)
                  </label>
                  <textarea
                    id="pay-memo"
                    value={memo}
                    onChange={(event) => setMemo(event.target.value)}
                    rows={2}
                    placeholder="사장님께 미리 알리고 싶은 내용"
                    className="input resize-none"
                  />
                </div>

                <div className="rounded-2xl bg-[#FFF8FB] p-3 text-[13px] ring-1 ring-ink-line">
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
                    <span className="text-[12px] font-bold text-ink">총 금액</span>
                    <span className="num text-[22px] font-extrabold leading-none tracking-[-0.02em] text-brand-dark">{won(total)}</span>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-[12px] text-ink-mute">
                    <CalendarIcon size={11} />
                    {formatDate(date)} {timeRange(startTime, hours)}
                  </p>
                </div>

                <BookingConsent checked={agreed} onChange={setAgreed} id="pay-booking-consent" />

                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] font-medium text-red-600">{error}</p>
                )}

                <button type="submit" disabled={submitting} className="btn-primary w-full py-3 text-[15px]">
                  {submitting ? "접수 중…" : `${won(total)} · 예약 신청하기`}
                </button>
                <p className="text-center text-[12px] leading-relaxed text-ink-mute">
                  신청 후 15분 안에 안내된 계좌로 입금하면 사장님 확인을 거쳐 확정돼요.
                </p>
              </div>
            </form>
          </div>
        )}
      </main>

      {!done && (
        <div className="ui-cta-bar md:hidden">
          <div className="ui-cta-sum">
            <small>
              {formatDate(date)} {timeRange(startTime, hours)} · {hours}시간
            </small>
            <strong>{won(total)}</strong>
          </div>
          <button
            type="button"
            onClick={() => formRef.current?.requestSubmit()}
            disabled={submitting}
            className="ui-cta-btn"
          >
            {submitting ? "접수 중…" : "예약 신청하기"}
          </button>
        </div>
      )}

      <footer className="border-t border-brand/10 bg-white/70">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-5 text-[12px] text-ink-mute sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5">
            <LogoMark size={20} shadow={false} decorative />
            <span className="text-[13px] text-ink">이곳저곳</span>
            <span>· 사장님이 만든 전용 예약 페이지</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <Link href="/terms" className="font-semibold hover:text-brand-dark">
              이용약관
            </Link>
            <Link href="/privacy" className="font-semibold hover:text-brand-dark">
              개인정보처리방침
            </Link>
            <Link href="/refund" className="font-semibold hover:text-brand-dark">
              취소·환불 규정
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
