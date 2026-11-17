import { CATEGORY_MAP } from "./constants";

export function won(value: number): string {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

export function wonShort(value: number): string {
  if (value >= 100000000) return `${(value / 100000000).toFixed(1).replace(/\.0$/, "")}억원`;
  if (value >= 10000) return `${Math.round(value / 10000).toLocaleString("ko-KR")}만원`;
  return won(value);
}

export function todayISO(): string {
  return toISO(new Date());
}

export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(days: number, base = new Date()): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function formatDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return `${m}월 ${d}일 (${WEEKDAYS[date.getDay()]})`;
}

export function formatDateShort(iso: string): string {
  if (!iso) return "";
  const parts = iso.split("-");
  return `${Number(parts[1])}.${Number(parts[2])}`;
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "오전" : "오후";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${period} ${hour12}:${String(m).padStart(2, "0")}`;
}

export function endTime(start: string, hours: number): string {
  const [h] = start.split(":").map(Number);
  const end = Math.min(h + hours, 24);
  if (end === 24) return "24:00";
  return `${String(end).padStart(2, "0")}:00`;
}

export function timeRange(start: string, hours: number): string {
  return `${formatTime(start)} ~ ${endTime(start, hours)}`;
}

export function categoryLabel(key: string): string {
  return CATEGORY_MAP[key as keyof typeof CATEGORY_MAP]?.label ?? key;
}

export function categoryEmoji(key: string): string {
  return CATEGORY_MAP[key as keyof typeof CATEGORY_MAP]?.emoji ?? "📍";
}

export function calcTotal(pricePerHour: number, hours: number, discountRate: number): number {
  const gross = pricePerHour * hours;
  return Math.round((gross * (100 - discountRate)) / 100);
}

export function formatRelativeDate(iso: string): string {
  const created = new Date(iso);
  const diff = Date.now() - created.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return `${created.getMonth() + 1}.${created.getDate()}`;
}

export function cn(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}

export function makeSlug(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function midnightCountdown(): string {
  const now = new Date();
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  const diff = Math.max(0, end.getTime() - now.getTime());
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
