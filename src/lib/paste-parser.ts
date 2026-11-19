/**
 * 외부 예약 붙여넣기 파서.
 *
 * 사장님이 카톡·문자·엑셀에서 복사한 여러 줄 텍스트를 줄 단위로 읽어
 * 날짜·시작 시간·이용 시간(시간)을 뽑아낸다. 인식한 부분은 문장에서 지워
 * 남은 글자를 메모(예약자 이름 등)로 쓴다.
 *
 * 지원 예)
 *   11/25 14:00~17:00
 *   2026-11-26 오후 2시~5시
 *   12월 1일 18:00-21:00 홍길동
 *   11.27 14시부터 17시까지 김철수 (3시간)
 *   내일 2시~5시 생일파티
 */
export interface ParsedBlockRow {
  raw: string;
  /** YYYY-MM-DD */
  date: string | null;
  /** HH:MM */
  startTime: string | null;
  hours: number | null;
  memo: string;
  /** 채워져 있으면 등록할 수 없는 줄 */
  error?: string;
}

const WEEKDAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toISO(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function normalize(line: string): string {
  return line
    .replace(/[\uFF10-\uFF19]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0)) // 전각 숫자
    .replace(/[～〜]/g, "~")
    .replace(/[–—−]/g, "-")
    .replace(/[\u00A0\u3000]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripLeadingBullet(line: string): string {
  return line
    .replace(/^[-•*·■□▪◦>]+\s*/, "")
    .replace(/^\d{1,2}[).]\s+/, "")
    .replace(/^\d{1,2}\s*\|\s*/, "") // 엑셀 셀 복사 흔적 "1 | ..."
    .trim();
}

/** 2026-11-25 같은 이미 완성된 날짜 */
function takeFullDate(rest: string, now: Date): { iso: string; rest: string } | null {
  const re = /(20\d{2})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})\s*일?/;
  const m = rest.match(re);
  if (!m) return null;
  const iso = `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`;
  return { iso, rest: rest.replace(m[0], " ") };
}

/** 11/25 · 11.25 · 11월 25일 (연도 생략) */
function takeShortDate(rest: string, now: Date): { iso: string; rest: string } | null {
  const re = /(\d{1,2})\s*[-./월]\s*(\d{1,2})\s*일?(?:\s*\(?([일월화수목금토])\)?)?/;
  const m = rest.match(re);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  let year = now.getFullYear();
  const candidate = new Date(year, month - 1, day);
  // 이미 두 달 넘게 지난 날짜면 내년으로 본다(연말·연초 입력 대응).
  const diffDays = (candidate.getTime() - now.getTime()) / 86400000;
  if (diffDays < -70) year += 1;
  return { iso: `${year}-${pad(month)}-${pad(day)}`, rest: rest.replace(m[0], " ") };
}

/** 오늘·내일·모레·금요일·다음주 화요일 */
function takeRelativeDate(rest: string, now: Date): { iso: string; rest: string } | null {
  const rel = rest.match(/(오늘|금일|당일|내일|명일|모레)/);
  if (rel) {
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const offset = rel[1] === "오늘" || rel[1] === "금일" || rel[1] === "당일" ? 0 : rel[1] === "내일" || rel[1] === "명일" ? 1 : 2;
    base.setDate(base.getDate() + offset);
    return { iso: toISO(base), rest: rest.replace(rel[0], " ") };
  }

  const weekday = rest.match(/(?:(이번|다음)\s*주\s*)?([일월화수목금토])요일/);
  if (weekday) {
    const target = WEEKDAY_LABEL.indexOf(weekday[2]);
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let add = (target - base.getDay() + 7) % 7;
    if (add === 0 && /오전|오후|\d{1,2}\s*[:시]/.test(rest) === false) add = 7;
    if (weekday[1] === "다음" && add === 0) add = 7;
    if (weekday[1]) add += 7;
    base.setDate(base.getDate() + add);
    return { iso: toISO(base), rest: rest.replace(weekday[0], " ") };
  }
  return null;
}

interface TimeHit {
  start: string;
  end?: string;
  rest: string;
}

const PERIOD = "(오전|오후|아침|점심|저녁|밤|낮)?";

function periodHour(period: string | undefined, hour: number, raw: string): number {
  const marker = period ?? "";
  if (marker === "오후" || marker === "저녁" || marker === "밤") {
    return hour < 12 ? hour + 12 : hour;
  }
  if (marker === "오전" || marker === "아침") {
    return hour === 12 ? 0 : hour;
  }
  if (marker === "점심") return hour < 12 ? hour + 12 : hour;
  if (marker === "낮") return hour < 12 ? hour + 12 : hour;
  // 시각 표시가 없는 1~6시는 예약 시간대상 오후로 본다(2시~5시 → 14:00~17:00).
  if (hour >= 1 && hour <= 6) return hour + 12;
  if (hour === 12) return 12;
  return hour;
}

function hhmm(hour: number, minute: number): string {
  const h = ((hour % 24) + 24) % 24;
  return `${pad(h)}:${pad(Math.min(59, Math.max(0, minute)))}`;
}

function takeTimeRange(rest: string): TimeHit | null {
  // 14:00~17:00 / 오후 2시~5시 / 2시부터 5시까지 / 14시-17시
  const re = new RegExp(
    `${PERIOD}\\s*(\\d{1,2})\\s*(?::|시)\\s*(\\d{1,2})?\\s*분?\\s*(?:부터|~|-|에서|부터\\s*)?\\s*` +
      `${PERIOD}\\s*(\\d{1,2})\\s*(?::|시)\\s*(\\d{1,2})?\\s*분?\\s*(?:까지)?`
  );
  const m = rest.match(re);
  if (!m) return null;

  const startPeriod = m[1];
  const startHour = Number(m[2]);
  const startMinute = Number(m[3] ?? 0);
  const endPeriod = m[4];
  const endHour = Number(m[5]);
  const endMinute = Number(m[6] ?? 0);
  if (startHour > 24 || endHour > 24) return null;

  let startH = periodHour(startPeriod, startHour, m[0]);
  let endH = periodHour(endPeriod, endHour, m[0]);
  // "오후 7시~9시"처럼 앞쪽에만 오전/오후가 붙으면 뒤쪽도 같은 오후로 본다.
  if (!endPeriod && endH < startH) endH += 12;
  if (endH < startH) return null;

  return {
    start: hhmm(startH, startMinute),
    end: hhmm(endH, endMinute),
    rest: rest.replace(m[0], " "),
  };
}

/** 시간 범위 없이 "14:00 3시간" / "오후 2시 2시간" 형태 */
function takeTimeWithDuration(rest: string): TimeHit | null {
  const re = new RegExp(`${PERIOD}\\s*(\\d{1,2})\\s*(?::|시)\\s*(\\d{1,2})?\\s*분?\\s*(?:부터)?\\s*,?\\s*(\\d{1,2})\\s*시간`);
  const m = rest.match(re);
  if (!m) return null;
  const startH = periodHour(m[1], Number(m[2]), m[0]);
  const hours = Number(m[4]);
  if (!Number.isFinite(hours) || hours < 1) return null;
  return { start: hhmm(startH, Number(m[3] ?? 0)), end: hhmm(startH + hours, Number(m[3] ?? 0)), rest: rest.replace(m[0], " ") };
}

function takeExplicitDuration(rest: string): { hours: number | null; rest: string } {
  const m = rest.match(/(\d{1,2})\s*시간(?:\s*(?:이용|사용|예약|대관))?/);
  if (!m) return { hours: null, rest };
  return { hours: Number(m[1]), rest: rest.replace(m[0], " ") };
}

function cleanMemo(rest: string): string {
  return rest
    .replace(/[()[\]{}<>]/g, " ")
    .replace(/[~,;:·|/\\]/g, " ")
    .replace(/(예약|확정|결제|입금|문의|부터|까지|오전|오후|금주|익일|오는)/g, " ")
    .replace(/[-+]+\s*$/, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

export function parseBookingLine(line: string, now = new Date()): ParsedBlockRow {
  const raw = line.trim();
  const row: ParsedBlockRow = { raw, date: null, startTime: null, hours: null, memo: "" };

  let rest = stripLeadingBullet(normalize(raw));
  if (!rest) {
    row.error = "빈 줄이에요.";
    return row;
  }

  const full = takeFullDate(rest, now);
  if (full) {
    row.date = full.iso;
    rest = full.rest;
  } else {
    const relative = takeRelativeDate(rest, now);
    if (relative) {
      row.date = relative.iso;
      rest = relative.rest;
    } else {
      const short = takeShortDate(rest, now);
      if (short) {
        row.date = short.iso;
        rest = short.rest;
      }
    }
  }

  // 여러 날에 걸친 일정(12/31 22:00 ~ 1/1 02:00)은 한 건으로 차단할 수 없다.
  if (row.date && /(20\d{2})\s*[-./년]\s*\d{1,2}\s*[-./월]\s*\d{1,2}/.test(rest)) {
    row.error = "여러 날에 걸친 일정이에요. 날짜별로 나눠 직접 등록해 주세요.";
    row.date = null;
    row.startTime = null;
    row.hours = null;
    row.memo = cleanMemo(rest);
    return row;
  }

  const durationFirst = takeExplicitDuration(rest);
  const durationHint = durationFirst.hours;
  rest = durationFirst.rest;

  const range = takeTimeRange(rest);
  if (range) {
    row.startTime = range.start;
    rest = range.rest;
    if (range.end) {
      const [sh, sm] = range.start.split(":").map(Number);
      const [eh, em] = range.end.split(":").map(Number);
      const minutes = eh * 60 + em - (sh * 60 + sm);
      // 시간 단위 예약이라 분 단위는 반올림한다(최소 1시간).
      if (minutes > 0 && minutes <= 24 * 60) row.hours = Math.max(1, Math.round(minutes / 60));
    }
  } else {
    const withDuration = takeTimeWithDuration(rest);
    if (withDuration?.end) {
      row.startTime = withDuration.start;
      const [sh, sm] = withDuration.start.split(":").map(Number);
      const [eh, em] = withDuration.end.split(":").map(Number);
      const minutes = eh * 60 + em - (sh * 60 + sm);
      if (minutes > 0) row.hours = Math.max(1, Math.round(minutes / 60));
      rest = withDuration.rest;
    } else {
      const single = rest.match(new RegExp(`${PERIOD}\\s*(\\d{1,2})\\s*(?::|시)\\s*(\\d{1,2})?\\s*분?`));
      if (single) {
        row.startTime = hhmm(periodHour(single[1], Number(single[2]), single[0]), Number(single[3] ?? 0));
        rest = rest.replace(single[0], " ");
      }
    }
  }

  if (row.hours === null && durationHint !== null) row.hours = durationHint;
  if (!row.hours || row.hours < 1) row.hours = row.hours ?? null;

  if (row.hours !== null && row.hours > 24) {
    row.error = "이용 시간이 24시간을 넘어요.";
    row.hours = null;
  }

  row.memo = cleanMemo(rest);

  if (!row.date) row.error = row.error ?? "날짜를 찾지 못했어요. 예) 11/25, 11월 25일, 2026-11-25";
  else if (!row.startTime) row.error = row.error ?? "시작 시간을 찾지 못했어요. 예) 14:00~17:00, 오후 2시~5시";
  else if (!row.hours || row.hours < 1) row.error = row.error ?? "이용 시간을 알 수 없어요. 예) 14:00~17:00, 14:00 3시간";

  return row;
}

/** 여러 줄 붙여넣기 → 줄별 파싱 결과 (빈 줄은 건너뛴다) */
export function parsePastedBookings(text: string, now = new Date()): ParsedBlockRow[] {
  return (text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseBookingLine(line, now));
}

/** 미리보기 상태: 이미 예약·차단된 시간과 겹치는지 */
export interface BusySlot {
  date: string;
  startTime: string;
  hours: number;
  source: "guest" | "block";
}

export function overlapsBusy(
  row: Pick<ParsedBlockRow, "date" | "startTime" | "hours">,
  busy: BusySlot[]
): "guest" | "block" | null {
  if (!row.date || !row.startTime || !row.hours) return null;
  const [sh, sm] = row.startTime.split(":").map(Number);
  const start = sh * 60 + sm;
  const end = start + Math.round(row.hours * 60);
  for (const slot of busy) {
    if (slot.date !== row.date) continue;
    const [bh, bm] = slot.startTime.split(":").map(Number);
    const bStart = bh * 60 + bm;
    const bEnd = bStart + Math.round(slot.hours * 60);
    if (start < bEnd && bStart < end) return slot.source;
  }
  return null;
}

/** 시간이 이미 지났는지 */
export function isPastSlot(row: Pick<ParsedBlockRow, "date" | "startTime">, now = new Date()): boolean {
  if (!row.date || !row.startTime) return false;
  const [h, m] = row.startTime.split(":").map(Number);
  const [y, mo, d] = row.date.split("-").map(Number);
  return new Date(y, mo - 1, d, h, m).getTime() <= now.getTime();
}
