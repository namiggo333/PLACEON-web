import type { BookingStatus, Category, Role } from "./types";

export const CATEGORIES: { key: Category; label: string; emoji: string; gradient: string }[] = [
  { key: "party", label: "파티룸", emoji: "🎉", gradient: "from-rose-400 via-pink-500 to-fuchsia-600" },
  { key: "kidsroom", label: "키즈룸", emoji: "🧸", gradient: "from-yellow-300 via-amber-400 to-orange-500" },
  { key: "practice", label: "연습실", emoji: "🎧", gradient: "from-violet-400 via-purple-500 to-indigo-600" },
  { key: "studio", label: "촬영스튜디오", emoji: "📸", gradient: "from-amber-300 via-orange-400 to-rose-500" },
  { key: "meeting", label: "회의실", emoji: "💼", gradient: "from-sky-400 via-blue-500 to-indigo-500" },
  { key: "kitchen", label: "공유주방", emoji: "🍳", gradient: "from-lime-300 via-emerald-400 to-teal-500" },
  { key: "rooftop", label: "루프탑", emoji: "🌇", gradient: "from-pink-400 via-rose-500 to-orange-400" },
  { key: "study", label: "스터디룸", emoji: "📚", gradient: "from-slate-300 via-slate-400 to-slate-600" },
];

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.key, c])) as Record<
  Category,
  (typeof CATEGORIES)[number]
>;

export const REGIONS = [
  "서울",
  "경기",
  "인천",
  "부산",
  "대구",
  "대전",
  "광주",
  "울산",
  "세종",
  "강원",
  "충북",
  "충남",
  "전북",
  "전남",
  "경북",
  "경남",
  "제주",
];

export const PRICE_RANGES = [
  { key: "all", label: "전체 가격", min: 0, max: Infinity },
  { key: "under3", label: "3만원 이하", min: 0, max: 30000 },
  { key: "3to5", label: "3~5만원", min: 30000, max: 50000 },
  { key: "5to10", label: "5~10만원", min: 50000, max: 100000 },
  { key: "over10", label: "10만원 이상", min: 100000, max: Infinity },
];

export const TIME_SLOTS = Array.from({ length: 15 }, (_, i) => {
  const hour = 8 + i;
  return `${String(hour).padStart(2, "0")}:00`;
});

export const HOUR_OPTIONS = [1, 2, 3, 4, 5, 6, 8];

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "대기중",
  confirmed: "예약확정",
  cancelled: "취소",
};

export const STATUS_STYLE: Record<BookingStatus, string> = {
  pending: "bg-amber-50 text-amber-600",
  confirmed: "bg-emerald-50 text-emerald-600",
  cancelled: "bg-slate-100 text-slate-500",
};

export const ROLE_LABEL: Record<Role, string> = {
  guest: "게스트",
  host: "사장님",
};

export const DEMO_ACCOUNTS = {
  guest: { email: "guest@placeon.kr", password: "placeon1234", name: "박기남", role: "guest" as Role },
  host: { email: "host@placeon.kr", password: "placeon1234", name: "김사장", role: "host" as Role },
};
