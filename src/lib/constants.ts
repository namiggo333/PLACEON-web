import type { BookingStatus, Category, Role } from "./types";

export const CATEGORIES: {
  key: Category;
  label: string;
  emoji: string;
  gradient: string;
  pastel: string;
  tone: string;
}[] = [
  {
    key: "party",
    label: "파티룸",
    emoji: "🎉",
    gradient: "from-[#FFD9E4] via-[#FFC2D4] to-[#FF9DBB]",
    pastel: "bg-[#FFE7EE]",
    tone: "text-[#F0578A]",
  },
  {
    key: "kidsroom",
    label: "키즈룸",
    emoji: "🧸",
    gradient: "from-[#FFF0C2] via-[#FFE29E] to-[#FFC97A]",
    pastel: "bg-[#FFF2CC]",
    tone: "text-[#D99B00]",
  },
  {
    key: "practice",
    label: "연습실",
    emoji: "🎧",
    gradient: "from-[#E7E0FF] via-[#D6C9FF] to-[#BFA9FF]",
    pastel: "bg-[#EEE9FF]",
    tone: "text-[#7B61FF]",
  },
  {
    key: "studio",
    label: "촬영스튜디오",
    emoji: "📸",
    gradient: "from-[#DCEFFF] via-[#C4E3FF] to-[#9FCBFF]",
    pastel: "bg-[#E4F2FF]",
    tone: "text-[#3B8FD9]",
  },
  {
    key: "meeting",
    label: "회의실",
    emoji: "💼",
    gradient: "from-[#DDF3E9] via-[#C3E9DB] to-[#9ED9C6]",
    pastel: "bg-[#E4F6EE]",
    tone: "text-[#2FA37A]",
  },
  {
    key: "kitchen",
    label: "공유주방",
    emoji: "🍳",
    gradient: "from-[#FFE3E9] via-[#FFD0D9] to-[#FFB9C8]",
    pastel: "bg-[#FFECE6]",
    tone: "text-[#E2624A]",
  },
  {
    key: "rooftop",
    label: "루프탑",
    emoji: "🌇",
    gradient: "from-[#FFE3DC] via-[#FFCBC0] to-[#FFAE9C]",
    pastel: "bg-[#FFE9E4]",
    tone: "text-[#EC6B4E]",
  },
  {
    key: "study",
    label: "스터디룸",
    emoji: "📚",
    gradient: "from-[#E8ECF3] via-[#D8DEE9] to-[#BFC7D6]",
    pastel: "bg-[#ECEFF5]",
    tone: "text-[#5B6784]",
  },
];

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.key, c])) as Record<
  Category,
  (typeof CATEGORIES)[number]
>;

export const ALL_CATEGORY_STYLE = {
  key: "all" as const,
  label: "전체",
  emoji: "✨",
  pastel: "bg-[#FFE4EF]",
  tone: "text-[#FF2E7E]",
};

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
