/**
 * iCalendar(.ics) 읽기/쓰기 최소 구현.
 *
 * - 내보내기: 공간의 예약·시간 차단을 손님 개인정보 없이 "이곳저곳 예약"/"이곳저곳 시간 차단"으로만 적는다.
 * - 가져오기: 외부 캘린더(구글·네이버·애플)의 VEVENT 에서 DTSTART/DTEND 를 읽어
 *   사장님 시간 차단(source='block')으로 옮길 수 있게 한다.
 */

export interface IcsEvent {
  uid: string;
  summary: string;
  location: string;
  /** KST 기준 "YYYY-MM-DDTHH:mm" */
  start: string;
  end: string;
  allDay: boolean;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** "20261125T140000" + (+09:00 / Z) → KST "2026-11-25T14:00" */
function parseIcsDateTime(raw: string, isUtc: boolean, tzid?: string): string | null {
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/);
  if (!match) return null;
  const [, y, mo, d, hh, mm] = match;
  if (!hh) return `${y}-${mo}-${d}T00:00`;
  const utc = isUtc || Boolean(match[7]);
  // 시간대가 UTC 면 KST(+9)로 옮긴다. 그 외(floating / TZID=Asia/Seoul)는 로컬 시각으로 본다.
  if (utc) {
    const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm ?? 0)));
    const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}T${pad(
      kst.getUTCHours()
    )}:${pad(kst.getUTCMinutes())}`;
  }
  void tzid;
  return `${y}-${mo}-${d}T${hh}:${mm ?? "00"}`;
}

/** 줄바꿈으로 접힌(folded) 줄을 편다 */
function unfold(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n");
}

function propertyValue(line: string): { name: string; params: Record<string, string>; value: string } | null {
  const index = line.indexOf(":");
  if (index < 0) return null;
  const head = line.slice(0, index);
  const value = line.slice(index + 1);
  const [name, ...paramParts] = head.split(";");
  const params: Record<string, string> = {};
  for (const part of paramParts) {
    const eq = part.indexOf("=");
    if (eq > 0) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value };
}

export interface ParseIcsResult {
  events: IcsEvent[];
  calendarName: string;
  error?: string;
}

export function parseIcs(text: string, limit = 500): ParseIcsResult {
  if (!text || !/BEGIN:VCALENDAR/i.test(text)) {
    return { events: [], calendarName: "", error: "iCalendar(.ics) 형식이 아니에요. BEGIN:VCALENDAR 로 시작해야 합니다." };
  }

  const lines = unfold(text);
  const events: IcsEvent[] = [];
  let calendarName = "";
  let current: Record<string, { value: string; params: Record<string, string> }> | null = null;

  for (const line of lines) {
    const upper = line.trim().toUpperCase();
    if (upper === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (upper === "END:VEVENT") {
      if (current) {
        const startRaw = current.DTSTART;
        const endRaw = current.DTEND;
        const duration = current.DURATION?.value ?? "";
        const start = startRaw ? parseIcsDateTime(startRaw.value, startRaw.params.VALUE !== "DATE", startRaw.params.TZID) : null;
        let end = endRaw ? parseIcsDateTime(endRaw.value, endRaw.params.VALUE !== "DATE", endRaw.params.TZID) : null;
        if (!end && start && /^PT(\d+)H/.test(duration)) {
          const hours = Number(duration.match(/^PT(\d+)H/)?.[1] ?? 0);
          if (hours > 0) {
            const [datePart, timePart] = start.split("T");
            const [y, mo, d] = datePart.split("-").map(Number);
            const [hh, mm] = timePart.split(":").map(Number);
            const next = new Date(Date.UTC(y, mo - 1, d, hh + hours, mm));
            end = `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}T${pad(
              next.getUTCHours()
            )}:${pad(next.getUTCMinutes())}`;
          }
        }
        if (start) {
          events.push({
            uid: current.UID?.value ?? "",
            summary: (current.SUMMARY?.value ?? "").slice(0, 120),
            location: (current.LOCATION?.value ?? "").slice(0, 120),
            start,
            end: end ?? start,
            allDay: startRaw?.params.VALUE === "DATE" || !start.includes("T"),
          });
        }
        if (events.length >= limit) break;
      }
      current = null;
      continue;
    }
    if (upper.startsWith("X-WR-CALNAME")) {
      const parsed = propertyValue(line);
      if (parsed?.value) calendarName = parsed.value;
      continue;
    }
    if (current) {
      const parsed = propertyValue(line);
      if (parsed) current[parsed.name] = { value: parsed.value, params: parsed.params };
    }
  }

  if (events.length === 0) {
    return { events, calendarName, error: "일정(VEVENT)을 찾지 못했어요." };
  }
  return { events, calendarName };
}

/* ------------------------------------------------------------------ */
/* 내보내기                                                            */
/* ------------------------------------------------------------------ */

export interface IcsSourceEvent {
  uid: string;
  /** 예약/차단 구분 */
  kind: "guest" | "block";
  /** pending 이면 "대기" 표시 */
  pending?: boolean;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  hours: number;
}

const CRLF = "\r\n";

/** RFC 5545: 75옥텟마다 줄을 접는다 */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 73) return line;
  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const char of line) {
    const size = Buffer.byteLength(char, "utf8");
    if (currentBytes + size > (chunks.length === 0 ? 73 : 72)) {
      chunks.push(current);
      current = char;
      currentBytes = size;
    } else {
      current += char;
      currentBytes += size;
    }
  }
  if (current) chunks.push(current);
  return chunks.join(`${CRLF} `);
}

function icsDateTime(date: string, time: string, plusHours = 0): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const value = new Date(Date.UTC(y, mo - 1, d, h + plusHours, mi));
  return `${value.getUTCFullYear()}${pad(value.getUTCMonth() + 1)}${pad(value.getUTCDate())}T${pad(
    value.getUTCHours()
  )}${pad(value.getUTCMinutes())}00`;
}

export function buildIcsCalendar(args: {
  calendarName: string;
  timezone?: string;
  events: IcsSourceEvent[];
  now?: Date;
}): string {
  const stamp = (() => {
    const now = args.now ?? new Date();
    return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(
      now.getUTCHours()
    )}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  })();

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//igotjeogot//SPACE PLATFORM//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${args.calendarName}`,
    "X-WR-TIMEZONE:Asia/Seoul",
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Seoul",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0900",
    "TZOFFSETTO:+0900",
    "TZNAME:KST",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];

  for (const event of args.events) {
    const summary =
      event.kind === "block"
        ? "이곳저곳 시간 차단"
        : event.pending
          ? "이곳저곳 예약 (입금 대기)"
          : "이곳저곳 예약";
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}@igotjeogot`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Asia/Seoul:${icsDateTime(event.date, event.startTime)}`,
      `DTEND;TZID=Asia/Seoul:${icsDateTime(event.date, event.startTime, event.hours)}`,
      `SUMMARY:${summary}`,
      "LOCATION:이곳저곳",
      "TRANSP:OPAQUE",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join(CRLF)}${CRLF}`;
}
