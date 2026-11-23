import type { ApprovalStatus, BookingStatus, Category, RefundStatus, Role } from "./types";

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

/** 실제 후기(리뷰) 기능이 붙기 전에는 시드 평점을 노출하지 않는다. */
export const REVIEWS_ENABLED = false;

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

/**
 * 예약 상태 배지 — 15분 미입금으로 자동 취소된 건은 '취소'가 아니라 '기한만료'로 보여 준다.
 */
export function bookingStatusMeta(booking: {
  status: BookingStatus;
  cancelReason?: "expired" | "host" | "guest" | null;
}): { label: string; style: string } {
  if (booking.status === "cancelled" && booking.cancelReason === "expired") {
    return { label: "기한만료", style: "bg-slate-100 text-slate-500" };
  }
  return { label: STATUS_LABEL[booking.status], style: STATUS_STYLE[booking.status] };
}

export const ROLE_LABEL: Record<Role, string> = {
  guest: "게스트",
  host: "사장님",
};

export const APPROVAL_LABEL: Record<ApprovalStatus, string> = {
  pending_review: "승인 대기",
  approved: "공개 중",
  rejected: "반려",
};

export const APPROVAL_STYLE: Record<ApprovalStatus, string> = {
  pending_review: "bg-amber-50 text-amber-600",
  approved: "bg-emerald-50 text-emerald-600",
  rejected: "bg-red-50 text-red-500",
};

export const REFUND_LABEL: Record<RefundStatus, string> = {
  none: "환불 없음",
  pending: "환불 필요",
  completed: "환불 완료",
};

export const REFUND_STYLE: Record<RefundStatus, string> = {
  none: "bg-slate-100 text-slate-500",
  pending: "bg-amber-50 text-amber-600",
  completed: "bg-emerald-50 text-emerald-600",
};

/** 예약 변경 이력(event_type)을 사람이 읽는 문구로 */
export const EVENT_LABEL: Record<string, string> = {
  created: "예약 신청",
  confirmed: "입금 확인 · 예약 확정",
  rejected: "사장님 거절",
  expired: "입금 기한 만료",
  cancelled: "예약 취소",
  reopened: "대기 상태로 되돌림",
  status_changed: "상태 변경",
  blocked: "사장님 시간 차단",
  unblocked: "시간 차단 해제",
  refund_pending: "환불 필요",
  refund_completed: "환불 완료",
  refund_cancelled: "환불 취소",
  refund_memo: "환불 메모",
};

export const ACTOR_LABEL: Record<string, string> = {
  guest: "손님",
  host: "사장님",
  admin: "관리자",
  system: "시스템",
};

/* ------------------------------------------------------------------ */
/* 이곳저곳 Item — 오픈 예정 카테고리·공간 유형                              */
/* ------------------------------------------------------------------ */

/**
 * 아직 판매 전인 '이곳저곳 Item'의 오픈 예정 카테고리.
 * 실제 재고·가격이 아니므로 금액은 두지 않고, 이름과 설명만 보여 준다.
 */
export const ITEM_CATEGORIES: {
  key: string;
  label: string;
  emoji: string;
  desc: string;
  pastel: string;
  tone: string;
}[] = [
  {
    key: "projector",
    label: "빔프로젝터·음향",
    emoji: "📽️",
    desc: "프로젝터·스크린·스피커·무선 마이크",
    pastel: "bg-[#EEE9FF]",
    tone: "text-[#7B61FF]",
  },
  {
    key: "furniture",
    label: "테이블·소파·가구",
    emoji: "🛋️",
    desc: "테이블·의자·소파·파티션·진열",
    pastel: "bg-[#FFECE6]",
    tone: "text-[#E2624A]",
  },
  {
    key: "climate",
    label: "냉난방·공기청정기",
    emoji: "❄️",
    desc: "에어컨·히터·제습기·공기청정기",
    pastel: "bg-[#E4F2FF]",
    tone: "text-[#3B8FD9]",
  },
  {
    key: "lighting",
    label: "조명·네온·소품",
    emoji: "💡",
    desc: "무드등·네온사인·촬영 조명·소품",
    pastel: "bg-[#FFF2CC]",
    tone: "text-[#D99B00]",
  },
  {
    key: "cleaning",
    label: "청소·위생가전",
    emoji: "🧹",
    desc: "청소기·건조기·정수기·음식물 처리",
    pastel: "bg-[#E4F6EE]",
    tone: "text-[#2FA37A]",
  },
  {
    key: "supplies",
    label: "소모품·어메니티",
    emoji: "📦",
    desc: "컵·수건·슬리퍼·일회용품·비품",
    pastel: "bg-[#FFE7EE]",
    tone: "text-[#F0578A]",
  },
];

export const ITEM_CATEGORY_KEYS = ITEM_CATEGORIES.map((item) => item.key);

export const ITEM_CATEGORY_MAP = Object.fromEntries(
  ITEM_CATEGORIES.map((item) => [item.key, item])
) as Record<string, (typeof ITEM_CATEGORIES)[number]>;

export function itemCategoryLabel(key: string): string {
  return ITEM_CATEGORY_MAP[key]?.label ?? key;
}

/** 사전 수요조사에서 고르는 공간 유형 (공간 카테고리 + 그 외) */
export const ITEM_SPACE_TYPES: { key: string; label: string; emoji: string }[] = [
  { key: "party", label: "파티룸", emoji: "🎉" },
  { key: "studio", label: "촬영스튜디오", emoji: "📸" },
  { key: "practice", label: "연습실", emoji: "🎧" },
  { key: "meeting", label: "회의실", emoji: "💼" },
  { key: "kidsroom", label: "키즈룸", emoji: "🧸" },
  { key: "kitchen", label: "공유주방", emoji: "🍳" },
  { key: "rooftop", label: "루프탑", emoji: "🌇" },
  { key: "study", label: "스터디룸", emoji: "📚" },
  { key: "other", label: "그 외 · 준비 중", emoji: "✨" },
];

export const ITEM_SPACE_TYPE_KEYS = ITEM_SPACE_TYPES.map((item) => item.key);

export function itemSpaceTypeLabel(key: string): string {
  return ITEM_SPACE_TYPES.find((item) => item.key === key)?.label ?? key;
}

export const DEMO_ACCOUNTS = {
  guest: { email: "guest@placeon.kr", password: "placeon1234", name: "박기남", role: "guest" as Role },
  host: { email: "host@placeon.kr", password: "placeon1234", name: "김사장", role: "host" as Role },
};
