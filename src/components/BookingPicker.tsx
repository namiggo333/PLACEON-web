"use client";

import { addDays, cn, formatTime, toISO, todayISO } from "@/lib/format";
import type { SlotStatus } from "@/lib/availability";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 날짜 스트립 — 오늘부터 14일을 가로로. 칩 56×72, 요일 12px / 날짜 18px.
 * 날짜 input 을 대신하는 주 선택 수단이고, 14일 밖은 날짜 input 으로 고른다.
 */
export function DateStrip({
  value,
  onChange,
  days = 14,
}: {
  value: string;
  onChange: (iso: string) => void;
  days?: number;
}) {
  const today = todayISO();
  const items = Array.from({ length: days }, (_, index) => {
    const date = addDays(index);
    return { iso: toISO(date), date };
  });

  return (
    <div className="ui-date-strip no-scrollbar" role="listbox" aria-label="이용 날짜">
      {items.map(({ iso, date }) => {
        const selected = value === iso;
        const isToday = iso === today;
        return (
          <button
            key={iso}
            type="button"
            role="option"
            aria-selected={selected}
            aria-pressed={selected}
            data-today={isToday}
            onClick={() => onChange(iso)}
            className={cn("ui-date-chip", !selected && isToday && "border-brand")}
          >
            <small>{isToday ? "오늘" : WEEKDAYS[date.getDay()]}</small>
            <b>{date.getDate()}</b>
          </button>
        );
      })}
    </div>
  );
}

/**
 * 시간 슬롯 — 48px, 4열. 마감(예약·차단)은 사선 해칭 + 취소선으로 색과 무관하게 구분된다.
 * 선택된 시작 칸에는 '시작', 선택 구간의 마지막 칸에는 '종료' 표시가 붙는다.
 */
export function SlotGrid({
  statuses,
  value,
  hours,
  onChange,
  emptyHint,
}: {
  statuses: SlotStatus[];
  value: string;
  hours: number;
  onChange: (start: string) => void;
  emptyHint?: string;
}) {
  const selectedIndex = statuses.findIndex((slot) => slot.start === value);
  const endIndex = selectedIndex >= 0 ? selectedIndex + hours - 1 : -1;
  const available = statuses.filter((slot) => !slot.taken && !slot.past).length;

  return (
    <div>
      <div className="ui-slot-grid">
        {statuses.map((slot, index) => {
          const selected = index === selectedIndex;
          const inRange = selectedIndex >= 0 && index > selectedIndex && index <= endIndex;
          const isEnd = index === endIndex && index !== selectedIndex;
          const [hh, mm] = slot.start.split(":");
          const label = slot.past
            ? "지난 시간"
            : slot.taken
              ? slot.blockedBy === "block"
                ? "차단됨"
                : "마감"
              : "";
          return (
            <button
              key={slot.start}
              type="button"
              aria-pressed={selected}
              aria-label={`${formatTime(slot.start)}${label ? ` ${label}` : ""}`}
              disabled={slot.taken || slot.past}
              onClick={() => onChange(slot.start)}
              className={cn(
                "ui-slot",
                slot.taken && "is-booked",
                slot.past && "is-past",
                inRange && "is-range",
                !slot.taken && !slot.past && selected && "shadow-sm"
              )}
            >
              <span>
                {hh}
                <span className="opacity-70">:{mm}</span>
              </span>
              {selected && <span className="ui-slot-tag">시작</span>}
              {isEnd && !selected && <span className="ui-slot-tag">종료</span>}
              {!selected && !isEnd && label && <span className="ui-slot-tag">{label}</span>}
            </button>
          );
        })}
      </div>
      <p className="ui-slot-note mt-2">
        {available === 0
          ? (emptyHint ?? "이 날은 예약 가능한 시간이 없어요. 다른 날짜를 골라 주세요.")
          : "회색 사선으로 표시된 시간은 예약·차단되었거나 지난 시간이에요."}
      </p>
    </div>
  );
}

/** 이용 시간 스테퍼 — − / N시간 / + (버튼 44px) */
export function HoursStepper({
  value,
  options,
  onChange,
}: {
  value: number;
  options: number[];
  onChange: (hours: number) => void;
}) {
  const index = Math.max(0, options.indexOf(value));
  const canDown = index > 0;
  const canUp = index < options.length - 1;

  return (
    <div className="flex items-center justify-between rounded-xl border border-ink-line px-2 py-1.5">
      <button
        type="button"
        onClick={() => canDown && onChange(options[index - 1])}
        disabled={!canDown}
        className="grid h-11 w-11 place-items-center rounded-xl bg-ink-line/60 text-xl font-bold text-ink-soft disabled:opacity-40"
        aria-label="이용 시간 줄이기"
      >
        −
      </button>
      <span className="text-[17px] font-bold text-ink">{value}시간</span>
      <button
        type="button"
        onClick={() => canUp && onChange(options[index + 1])}
        disabled={!canUp}
        className="grid h-11 w-11 place-items-center rounded-xl bg-ink-line/60 text-xl font-bold text-ink-soft disabled:opacity-40"
        aria-label="이용 시간 늘리기"
      >
        +
      </button>
    </div>
  );
}

/** 인원 스테퍼 — 버튼 44px */
export function GuestStepper({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (count: number) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-ink-line px-2 py-1.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="grid h-11 w-11 place-items-center rounded-xl bg-ink-line/60 text-xl font-bold text-ink-soft"
        aria-label="인원 줄이기"
      >
        −
      </button>
      <span className="text-[17px] font-bold text-ink">{value}명</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="grid h-11 w-11 place-items-center rounded-xl bg-ink-line/60 text-xl font-bold text-ink-soft"
        aria-label="인원 늘리기"
      >
        +
      </button>
    </div>
  );
}
