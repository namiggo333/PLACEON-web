"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { BookingConsent } from "@/components/ConsentCheckbox";
import { DepositGuide } from "@/components/DepositGuide";
import { LogoMark, MascotAvatar } from "@/components/Logo";
import { SpaceMedia } from "@/components/SpaceCard";
import { CheckIcon, ClockIcon, PinIcon, UsersIcon } from "@/components/Icons";
import { CATEGORY_MAP, HOUR_OPTIONS, TIME_SLOTS } from "@/lib/constants";
import { calcTotal, cn, endTime, formatDate, formatTime, shortId, todayISO, won } from "@/lib/format";
import type { Booking } from "@/lib/types";

export default function PayPage() {
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

  useEffect(() => {
    if (user) {
      setName((value) => value || user.name);
      setPhone((value) => value || user.phone);
    }
  }, [user]);

  if (!ready) {
    return (
      <div className="min-h-dvh bg-brand-light/60 p-4">
        <div className="mx-auto mt-10 max-w-lg skeleton h-96" />
      </div>
    );
  }

  if (!space) {
    return (
      <div className="min-h-dvh bg-brand-light/60 px-4 py-16">
        <div className="mx-auto max-w-md rounded-xl2 bg-white p-8 text-center shadow-card">
          <MascotAvatar size={76} className="mx-auto" />
          <h1 className="mt-3 text-lg font-black text-ink">링크를 찾을 수 없어요</h1>
          <p className="mt-1 text-xs leading-relaxed text-ink-mute">
            사장님이 링크를 새로 만들었거나 공간이 삭제되었을 수 있어요. 사장님께 다시 링크를 요청해 주세요.
          </p>
          <Link href="/" className="btn-primary mt-5 w-full">
            이곳저곳 홈으로
          </Link>
        </div>
      </div>
    );
  }

  const subtotal = space.pricePerHour * hours;
  const total = calcTotal(space.pricePerHour, hours, space.discountRate);
  const discount = subtotal - total;
  const category = CATEGORY_MAP[space.category];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!space) return;
    setError("");
    if (!name.trim()) return setError("예약자 이름을 입력해 주세요.");
    if (!phone.trim()) return setError("연락처를 입력해 주세요.");
    if (guests > space.capacity) return setError(`이 공간은 최대 ${space.capacity}명까지 이용할 수 있어요.`);
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
        source: "link",
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
    <div className="min-h-dvh bg-gradient-to-b from-brand-light via-[#FFF8FB] to-white">
      <header className="border-b border-brand/10 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2" aria-label="이곳저곳 홈">
            <LogoMark size={30} decorative />
            <span className="text-[17px] font-black tracking-[-0.035em] text-ink">이곳저곳</span>
            <MascotAvatar size={26} ring={false} className="ml-0.5 hidden sm:inline-grid" />
          </Link>
          <span className="badge bg-brand-light text-brand">간편 예약 · 로그인 없이</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        {done ? (
          <div className="animate-pop-in rounded-xl2 bg-white p-6 shadow-float sm:p-8">
            <div className="flex flex-col items-center text-center">
              <span className="relative">
                <MascotAvatar size={86} />
                <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-emerald-500 text-white ring-2 ring-white">
                  <CheckIcon size={16} />
                </span>
              </span>
              <h1 className="mt-3 text-xl font-black text-ink">예약 신청이 접수됐어요</h1>
              <p className="mt-1 text-xs text-ink-mute">
                예약번호 <b className="text-ink">{shortId(done.id)}</b> · 15분 안에 입금하면 예약이 확정돼요.
              </p>
            </div>

            <dl className="mt-5 space-y-2 rounded-xl bg-ink-line/30 p-4 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-mute">공간</dt>
                <dd className="text-right font-bold text-ink">{done.spaceName}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-mute">일시</dt>
                <dd className="text-right font-bold text-ink">
                  {formatDate(done.date)} {formatTime(done.startTime)} ~ {endTime(done.startTime, done.hours)}
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
                <dd className="text-right text-base font-black text-brand">{won(done.totalAmount)}</dd>
              </div>
            </dl>

            <DepositGuide booking={done} className="mt-4" />

            <div className="mt-4 flex flex-col gap-2">
              {user && (
                <Link href="/bookings" className="btn-primary w-full">
                  예약 내역 보기
                </Link>
              )}
              <Link href="/" className={cn("w-full", user ? "btn-ghost" : "btn-primary")}>
                이곳저곳 둘러보기
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="overflow-hidden rounded-xl2 bg-white shadow-card">
              <div className="relative h-40 sm:h-48">
                <SpaceMedia space={space} emojiSize="text-6xl" showLabel />
              </div>
              <div className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="badge bg-brand-light text-brand">{category.label}</span>
                  {space.discountRate > 0 && (
                    <span className="badge bg-brand text-white">타임특가 {space.discountRate}%</span>
                  )}
                </div>
                <h1 className="mt-2 text-xl font-black tracking-tight text-ink">{space.name}</h1>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-soft">
                  <PinIcon size={13} className="text-ink-mute" />
                  {space.address || `${space.region} ${space.district}`}
                </p>
                <div className="mt-2 flex items-baseline gap-1.5">
                  {space.discountRate > 0 && (
                    <span className="text-sm font-black text-brand">{space.discountRate}%</span>
                  )}
                  <span className="text-lg font-black text-ink">
                    {won(Math.round((space.pricePerHour * (100 - space.discountRate)) / 100))}
                  </span>
                  <span className="text-[11px] text-ink-mute">/시간</span>
                  {space.discountRate > 0 && (
                    <span className="text-[11px] text-ink-mute line-through">{won(space.pricePerHour)}</span>
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-soft">{space.description}</p>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-mute">
                  <span className="inline-flex items-center gap-1">
                    <UsersIcon size={13} />
                    최대 {space.capacity}명
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <ClockIcon size={13} />
                    시간 단위 예약
                  </span>
                  <span>호스트 {space.hostName}</span>
                </div>
              </div>
            </div>

            <form onSubmit={submit} className="rounded-xl2 bg-white p-4 shadow-card sm:p-5">
              <h2 className="text-sm font-extrabold text-ink">예약 정보 입력</h2>
              <p className="mt-0.5 text-[11px] text-ink-mute">날짜와 시간만 고르면 끝나요. 3초면 예약 완료!</p>

              <div className="mt-3 space-y-3">
                <div>
                  <label className="label" htmlFor="pay-date">이용 날짜</label>
                  <input
                    id="pay-date"
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
                    <label className="label" htmlFor="pay-start">시작 시간</label>
                    <select
                      id="pay-start"
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
                    <label className="label" htmlFor="pay-hours">이용 시간</label>
                    <select
                      id="pay-hours"
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

                <div className="flex items-center justify-between rounded-xl border border-ink-line px-3 py-2">
                  <span className="text-xs font-bold text-ink-soft">인원</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setGuests((value) => Math.max(1, value - 1))}
                      className="grid h-7 w-7 place-items-center rounded-lg bg-ink-line/60 text-sm font-bold text-ink-soft"
                      aria-label="인원 줄이기"
                    >
                      −
                    </button>
                    <span className="w-10 text-center text-sm font-bold text-ink">{guests}명</span>
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

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label" htmlFor="pay-name">예약자 이름</label>
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
                    <label className="label" htmlFor="pay-phone">연락처</label>
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
                  <label className="label" htmlFor="pay-memo">요청 사항 (선택)</label>
                  <textarea
                    id="pay-memo"
                    value={memo}
                    onChange={(event) => setMemo(event.target.value)}
                    rows={2}
                    placeholder="사장님께 미리 알리고 싶은 내용"
                    className="input resize-none"
                  />
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
                  <div className="mt-1.5 flex justify-between border-t border-ink-line pt-1.5 text-sm font-black text-ink">
                    <span>총 금액</span>
                    <span className="text-brand">{won(total)}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-ink-mute">
                    {formatDate(date)} {formatTime(startTime)} ~ {endTime(startTime, hours)}
                  </p>
                </div>

                <BookingConsent checked={agreed} onChange={setAgreed} id="pay-booking-consent" />

                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-[11px] font-medium text-red-600">{error}</p>
                )}

                <button type="submit" disabled={submitting} className="btn-primary w-full py-3">
                  {submitting ? "접수 중…" : "예약 신청하기"}
                </button>
                <p className="text-center text-[10px] leading-relaxed text-ink-mute">
                  예약 신청 후 15분 안에 안내된 계좌로 입금하면 사장님 확인을 거쳐 확정돼요.
                </p>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
