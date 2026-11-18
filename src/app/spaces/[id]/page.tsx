"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
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
  StarIcon,
  UsersIcon,
} from "@/components/Icons";
import { CATEGORY_MAP, HOUR_OPTIONS, TIME_SLOTS } from "@/lib/constants";
import { calcTotal, cn, endTime, formatDate, formatTime, shortId, todayISO, won } from "@/lib/format";
import type { Booking } from "@/lib/types";

export default function SpaceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { spaces, ready, user, createBooking } = useApp();
  const space = spaces.find((item) => item.id === params.id);
  const [date, setDate] = useState(todayISO());
  const [startTime, setStartTime] = useState("18:00");
  const [hours, setHours] = useState(2);
  const [guests, setGuests] = useState(2);
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Booking | null>(null);
  const [showPayGuide, setShowPayGuide] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    if (user) {
      setName((value) => value || user.name);
      setPhone((value) => value || user.phone);
    }
  }, [user]);

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
  const end = endTime(startTime, hours);
  const photos = space.imageUrls ?? [];
  const safePhotoIndex = photos.length > 0 ? Math.min(photoIndex, photos.length - 1) : 0;

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
        source: "web",
      });
      setDone(booking);
    } catch (err) {
      setError(err instanceof Error ? err.message : "예약 신청에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container-page py-5 pb-28 sm:py-8 md:pb-8">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-ink-mute hover:text-brand"
      >
        <ArrowLeftIcon size={15} />
        돌아가기
      </button>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
        <div className="min-w-0">
          <div className="overflow-hidden rounded-xl2 border border-ink-line">
            <div className="aspect-[16/10] w-full sm:aspect-[16/9]">
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

          {space.hidden && (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] font-medium leading-relaxed text-amber-800">
              <span className="shrink-0">🔒</span>
              지금은 비공개로 설정된 공간이에요. 사장님에게만 보이고, 손님 화면(홈·검색)에는 노출되지 않아요.
            </p>
          )}

          <div className="mt-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge bg-brand-light text-brand">{category.label}</span>
              {space.featured && <span className="badge bg-ink text-white">지역 상단 노출 AD</span>}
              {space.timeDeal && space.discountRate > 0 && (
                <span className="badge bg-brand text-white">타임특가 {space.discountRate}%</span>
              )}
              <span className="badge bg-emerald-50 text-emerald-600">실시간 예약 가능</span>
            </div>
            <h1 className="mt-3 text-2xl font-black leading-snug tracking-tight text-ink sm:text-3xl">
              {space.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-soft">
              <span className="inline-flex items-center gap-1">
                <PinIcon size={14} className="text-ink-mute" />
                {space.address || `${space.region} ${space.district}`}
              </span>
              <span className="inline-flex items-center gap-1">
                <UsersIcon size={14} className="text-ink-mute" />
                최대 {space.capacity}명
              </span>
              <span className="inline-flex items-center gap-1">
                <StarIcon size={13} className="text-amber-400" />
                {space.reviewCount > 0 ? `${space.rating.toFixed(1)} (${space.reviewCount})` : "신규 공간"}
              </span>
            </div>
          </div>

          <section className="mt-7 border-t border-ink-line pt-6">
            <h2 className="text-base font-extrabold text-ink">공간 소개</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{space.description}</p>
          </section>

          <section className="mt-7 border-t border-ink-line pt-6">
            <h2 className="text-base font-extrabold text-ink">제공 시설</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {space.amenities.map((amenity) => (
                <span
                  key={amenity}
                  className="inline-flex items-center gap-1 rounded-lg bg-brand-light/70 px-2.5 py-1.5 text-xs font-medium text-ink-soft"
                >
                  <CheckIcon size={13} className="text-brand" />
                  {amenity}
                </span>
              ))}
            </div>
          </section>

          <section className="mt-7 border-t border-ink-line pt-6">
            <h2 className="text-base font-extrabold text-ink">이용 안내</h2>
            <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-ink-soft">
              <li>· 예약 신청 후 사장님이 확인하면 연락처로 확정 안내를 드려요.</li>
              <li>· 이용 시작 20분 전까지 도착해 주시면 세팅 시간을 드릴 수 있어요.</li>
              <li>· 실내 음주는 공간 규칙에 따라 가능하며, 반려동물은 사전 문의해 주세요.</li>
              <li>· 이용 3일 전까지 무료 취소, 이후에는 사장님과 협의가 필요해요.</li>
            </ul>
          </section>

          <section className="mt-7 border-t border-ink-line pt-6">
            <h2 className="text-base font-extrabold text-ink">호스트</h2>
            <div className="mt-3 flex items-center justify-between rounded-xl2 border border-ink-line bg-white p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-light text-base font-extrabold text-brand">
                  {space.hostName.slice(0, 1)}
                </span>
                <div>
                  <p className="text-sm font-bold text-ink">{space.hostName}</p>
                  <p className="text-[11px] text-ink-mute">이곳저곳 호스트</p>
                </div>
              </div>
              <span className="badge bg-brand-light text-brand">
                <SparkleIcon size={12} />
                전용 예약 링크 운영
              </span>
            </div>
          </section>

          {similar.length > 0 && (
            <section className="mt-8 border-t border-ink-line pt-6">
              <h2 className="text-base font-extrabold text-ink">비슷한 공간</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {similar.slice(0, 3).map((item) => (
                  <SpaceCard key={item.id} space={item} />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside id="booking" className="scroll-mt-20 lg:sticky lg:top-24 lg:self-start">
          {done ? (
            <div className="card animate-pop-in p-5">
              <div className="flex flex-col items-center text-center">
                <span className="relative">
                  <MascotAvatar size={76} />
                  <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-emerald-500 text-white ring-2 ring-white">
                    <CheckIcon size={14} />
                  </span>
                </span>
                <h2 className="mt-3 text-lg font-black text-ink">예약 신청 완료!</h2>
                <p className="mt-1 text-xs text-ink-mute">
                  사장님이 확인하면 예약이 확정돼요.
                  <br />
                  예약번호 {shortId(done.id)}
                </p>
              </div>

              <dl className="mt-4 space-y-2 rounded-xl bg-ink-line/30 p-3.5 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-mute">공간</dt>
                  <dd className="text-right font-semibold text-ink">{done.spaceName}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-mute">일시</dt>
                  <dd className="text-right font-semibold text-ink">
                    {formatDate(done.date)} {formatTime(done.startTime)} ~ {endTime(done.startTime, done.hours)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-mute">인원</dt>
                  <dd className="text-right font-semibold text-ink">{done.guests}명 · {done.hours}시간</dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-ink-line pt-2">
                  <dt className="font-semibold text-ink">이용 요금</dt>
                  <dd className="text-right text-sm font-extrabold text-brand">{won(done.totalAmount)}</dd>
                </div>
              </dl>

              <div className="mt-3 rounded-xl border border-brand/20 bg-brand-light p-3.5">
                <p className="text-[11px] font-extrabold text-brand">예약 확정 안내</p>
                <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-ink-soft">
                  <li>사장님이 예약 내용을 확인하고, 연락처로 확정 여부를 알려드려요.</li>
                  <li>결제는 확정 안내와 함께 사장님이 알려드리는 방법으로 진행돼요.</li>
                  <li>이용 3일 전까지는 무료로 취소할 수 있어요.</li>
                </ol>
              </div>

              <div className="mt-3 flex flex-col gap-2">
                <Link href="/bookings" className="btn-primary w-full">
                  예약 내역 보기
                </Link>
                <button
                  type="button"
                  onClick={() => setShowPayGuide((value) => !value)}
                  className="btn-ghost w-full"
                >
                  <LinkIcon size={15} />
                  호스트 결제 링크 안내
                </button>
                {showPayGuide && (
                  <div className="rounded-xl bg-brand-light p-3 text-[11px] leading-relaxed text-ink-soft">
                    이 공간의 전용 결제 링크로 이동하면 카드로 바로 결제할 수 있어요.
                    <Link
                      href={`/pay/${space.paySlug}`}
                      className="mt-2 flex items-center justify-center gap-1 rounded-lg bg-white px-3 py-2 font-bold text-brand"
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
                  }}
                  className="text-xs font-semibold text-ink-mute hover:text-brand"
                >
                  다른 시간으로 예약하기
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="card p-5">
              <div className="flex items-baseline justify-between">
                <div>
                  {space.discountRate > 0 && (
                    <span className="mr-1.5 text-sm font-extrabold text-brand">{space.discountRate}%</span>
                  )}
                  <span className="text-2xl font-black text-ink">{won(total)}</span>
                  <span className="ml-1 text-xs text-ink-mute">/ {hours}시간</span>
                </div>
                {space.discountRate > 0 && (
                  <span className="text-xs text-ink-mute line-through">{won(subtotal)}</span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-ink-mute">시간당 {won(space.pricePerHour)} · 최대 {space.capacity}명</p>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="label" htmlFor="date">
                    이용 날짜
                  </label>
                  <input
                    id="date"
                    type="date"
                    min={todayISO()}
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className="input"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label" htmlFor="start">
                      시작 시간
                    </label>
                    <select
                      id="start"
                      value={startTime}
                      onChange={(event) => setStartTime(event.target.value)}
                      className="input"
                    >
                      {TIME_SLOTS.map((slot) => (
                        <option key={slot} value={slot}>
                          {formatTime(slot)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="hours">
                      이용 시간
                    </label>
                    <select
                      id="hours"
                      value={hours}
                      onChange={(event) => setHours(Number(event.target.value))}
                      className="input"
                    >
                      {HOUR_OPTIONS.map((hour) => (
                        <option key={hour} value={hour}>
                          {hour}시간
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="guests">
                    인원
                  </label>
                  <div className="flex items-center justify-between rounded-xl border border-ink-line px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setGuests((value) => Math.max(1, value - 1))}
                      className="grid h-7 w-7 place-items-center rounded-lg bg-ink-line/60 text-sm font-bold text-ink-soft"
                      aria-label="인원 줄이기"
                    >
                      −
                    </button>
                    <span className="text-sm font-bold text-ink">{guests}명</span>
                    <button
                      type="button"
                      onClick={() => setGuests((value) => Math.min(space.capacity, value + 1))}
                      className="grid h-7 w-7 place-items-center rounded-lg bg-ink-line/60 text-sm font-bold text-ink-soft"
                      aria-label="인원 늘리기"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="rounded-xl bg-ink-line/30 p-3 text-[11px]">
                  <div className="flex justify-between text-ink-soft">
                    <span>
                      {won(space.pricePerHour)} × {hours}시간
                    </span>
                    <span>{won(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="mt-1 flex justify-between text-brand">
                      <span>타임특가 {space.discountRate}% 할인</span>
                      <span>−{won(discount)}</span>
                    </div>
                  )}
                  <div className="mt-1.5 flex justify-between border-t border-ink-line pt-1.5 text-xs font-extrabold text-ink">
                    <span>총 결제 금액</span>
                    <span>{won(total)}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-ink-mute">
                    {formatDate(date)} {formatTime(startTime)} ~ {end}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
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

                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-[11px] font-medium text-red-600">{error}</p>
                )}

                <button type="submit" disabled={submitting} className="btn-primary w-full py-3">
                  <BoltIcon size={16} />
                  {submitting ? "예약 신청 중…" : user ? "예약 신청하기" : "로그인하고 예약하기"}
                </button>
                <p className="text-center text-[10px] leading-relaxed text-ink-mute">
                  예약 신청 후 사장님 확인 → 결제 안내 순서로 진행돼요.
                </p>
              </div>
            </form>
          )}

          <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-ink-mute">
            <span className="inline-flex items-center gap-1">
              <CalendarIcon size={12} />
              즉시 신청
            </span>
            <span className="inline-flex items-center gap-1">
              <ClockIcon size={12} />
              빠른 확인
            </span>
            <span className={cn("inline-flex items-center gap-1")}>
              <CheckIcon size={12} />
              안전한 예약
            </span>
          </div>
        </aside>
      </div>

      {!done && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-ink-line bg-white/95 px-4 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-baseline gap-1">
                {space.discountRate > 0 && (
                  <span className="text-[11px] font-extrabold text-brand">{space.discountRate}%</span>
                )}
                <span className="text-lg font-black text-ink">{won(total)}</span>
                <span className="text-[10px] text-ink-mute">/ {hours}시간</span>
              </p>
              <p className="truncate text-[10px] text-ink-mute">
                {formatDate(date)} {formatTime(startTime)} ~ {end}
              </p>
            </div>
            <button
              type="button"
              onClick={() => document.getElementById("booking")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="btn-primary shrink-0 px-5 py-2.5"
            >
              예약하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
