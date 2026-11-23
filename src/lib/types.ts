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
/** 예약 유입 채널: 사이트(web) / 전용 결제 링크(link) */
export type BookingChannel = "web" | "link";
/** 예약 종류: 손님 예약(guest) / 사장님 시간 차단(block) */
export type BookingSource = "guest" | "block";
/** 취소 사유: 15분 미입금 자동 만료 / 사장님 거절·취소 / 손님 취소 */
export type CancelReason = "expired" | "host" | "guest";
/** 환불 진행 상태 */
export type RefundStatus = "none" | "pending" | "completed";
/** 공간 공개 승인 상태 */
export type ApprovalStatus = "pending_review" | "approved" | "rejected";

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
  /* 관리자 승인 상태 — approved 만 손님 화면·예약에 노출된다 */
  approvalStatus: ApprovalStatus;
  /* 반려 사유 (관리자가 반려한 경우) */
  rejectionReason: string;
  approvedAt: string | null;
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
  /* 확정 후에만 공개되는 상세 정보 (spaces_private 테이블) */
  detailAddress?: string;
  entryGuide?: string;
  parkingGuide?: string;
}

/** 확정된 예약자에게만 공개되는 상세주소·출입 안내 */
export interface SpacePrivate {
  detailAddress: string;
  entryGuide: string;
  parkingGuide: string;
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
  /** 유입 채널 (웹/전용 링크) */
  channel: BookingChannel;
  /** 예약 종류 (손님 예약/사장님 시간 차단) */
  source: BookingSource;
  /** 환불 진행 상태 */
  refundStatus: RefundStatus;
  /** 비로그인 예약 확인용 토큰 — 발급 직후 브라우저에만 보관한다 */
  accessToken?: string | null;
  createdAt: string;
  /* 입금 기한 (pending 이면 now + 15분) */
  expiresAt: string | null;
  /* 손님이 '입금했어요'를 누른 시각 — 있으면 만료가 12시간 보류된다 */
  paidClaimedAt?: string | null;
  /* 손님이 입력한 입금자명 (사장님이 통장과 대조) */
  depositorName?: string;
  /* 예약 접수 시점의 입금 계좌 스냅샷 — 손님에게 안내되는 값 */
  payBankName: string;
  payAccountNumber: string;
  payAccountHolder: string;
  cancelReason: CancelReason | null;
}

/** 예약 상태 변경 이력 */
export interface BookingEvent {
  id: string;
  bookingId: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  actor: string;
  memo: string;
  createdAt: string;
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
  channel?: BookingChannel;
}

/** 이곳저곳 Item 사전 수요조사·오픈 알림 신청 */
export interface ItemWaitlistEntry {
  id: string;
  /** 희망 비품 카테고리 키 (projector, furniture, climate, lighting, cleaning, supplies) */
  categories: string[];
  customItem: string;
  spaceType: string;
  budgetOrQty: string;
  contactType: "phone" | "email";
  contact: string;
  note: string;
  wantsNotice: boolean;
  source: string;
  createdAt: string;
  /** 처리 상태 — 접수(new) · 연락완료(contacted) · 처리완료(done) */
  status: ItemWaitlistStatus;
  /** 관리자 메모(연락 결과·처리 내용) */
  adminMemo: string;
}

export type ItemWaitlistStatus = "new" | "contacted" | "done";

/** 이곳저곳 Item 상품 판매 상태 */
export type ItemProductStatus = "active" | "restocking" | "soldout" | "hidden";

/** 총괄 관리자가 등록한 이곳저곳 Item 판매 상품 */
export interface ItemProduct {
  id: string;
  name: string;
  /** 카테고리 키 (projector, furniture, climate, lighting, cleaning, supplies) */
  category: string;
  description: string;
  price: number;
  /** 판매 단위 (예: 1대, 1세트(10개)) */
  unit: string;
  stock: number;
  status: ItemProductStatus;
  imageUrl: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** 상품 등록·수정 입력 */
export interface ItemProductInput {
  name: string;
  category: string;
  description?: string;
  price: number;
  unit?: string;
  stock: number;
  status?: ItemProductStatus;
  imageUrl?: string | null;
  sortOrder?: number;
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

/** 매출·정산 집계에 포함되는 예약인지 (취소·시간 차단 제외) */
export function countsForRevenue(booking: Pick<Booking, "status" | "source">): boolean {
  return booking.status !== "cancelled" && booking.source !== "block";
}
