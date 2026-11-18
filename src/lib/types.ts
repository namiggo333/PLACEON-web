export type Category =
  | "party"
  | "kidsroom"
  | "practice"
  | "studio"
  | "meeting"
  | "kitchen"
  | "rooftop"
  | "study";

export type Role = "guest" | "host";
export type BookingStatus = "pending" | "confirmed" | "cancelled";
export type BookingSource = "web" | "link";
/** 취소 사유: 15분 미입금 자동 만료 / 사장님 거절·취소 / 손님 취소 */
export type CancelReason = "expired" | "host" | "guest";

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone: string;
  createdAt: string;
}

/** 사장님 입금 계좌 */
export interface BankAccount {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

export interface Space {
  id: string;
  hostId: string;
  hostName: string;
  name: string;
  category: Category;
  region: string;
  district: string;
  address: string;
  pricePerHour: number;
  capacity: number;
  discountRate: number;
  description: string;
  amenities: string[];
  rating: number;
  reviewCount: number;
  featured: boolean;
  timeDeal: boolean;
  paySlug: string;
  /* 대표 사진(imageUrls[0]) — 예전 데이터 호환용으로 남겨 둔다 */
  imageUrl: string | null;
  imageUrls: string[];
  /* true 이면 손님 화면(홈·검색·상세)에서 숨김 */
  hidden: boolean;
  createdAt: string;
}

export interface SpaceInput {
  name: string;
  category: Category;
  region: string;
  district: string;
  address: string;
  pricePerHour: number;
  capacity: number;
  discountRate: number;
  description: string;
  amenities: string[];
  imageUrls?: string[];
  featured?: boolean;
  timeDeal?: boolean;
  hidden?: boolean;
  /* 입금 계좌 (space_accounts 테이블에 함께 저장) */
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
}

export interface Booking {
  id: string;
  spaceId: string;
  spaceName: string;
  hostId: string;
  guestId: string | null;
  guestName: string;
  guestPhone: string;
  date: string;
  startTime: string;
  hours: number;
  guests: number;
  totalAmount: number;
  status: BookingStatus;
  memo: string;
  source: BookingSource;
  createdAt: string;
  /* 입금 기한 (pending 이면 now + 15분) */
  expiresAt: string | null;
  /* 예약 접수 시점의 입금 계좌 스냅샷 — 손님에게 안내되는 값 */
  payBankName: string;
  payAccountNumber: string;
  payAccountHolder: string;
  cancelReason: CancelReason | null;
}

export interface BookingInput {
  space: Space;
  date: string;
  startTime: string;
  hours: number;
  guests: number;
  guestName: string;
  guestPhone: string;
  memo?: string;
  source?: BookingSource;
}

/** 예약에 안내된 입금 계좌가 모두 채워져 있는지 */
export function hasDepositAccount(account: {
  payBankName?: string | null;
  payAccountNumber?: string | null;
  payAccountHolder?: string | null;
} | null | undefined): boolean {
  if (!account) return false;
  return Boolean(
    (account.payBankName ?? "").trim() &&
      (account.payAccountNumber ?? "").trim() &&
      (account.payAccountHolder ?? "").trim()
  );
}
