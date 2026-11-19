import type {
  ApprovalStatus,
  Booking,
  BookingChannel,
  BookingEvent,
  BookingSource,
  BookingStatus,
  CancelReason,
  Profile,
  RefundStatus,
  Role,
  Space,
  SpacePrivate,
} from "./types";

export interface ProfileRow {
  id: string;
  email: string;
  name: string | null;
  role: string | null;
  phone: string | null;
  created_at: string | null;
}

export interface SpaceRow {
  id: string;
  host_id: string;
  host_name: string | null;
  name: string;
  category: string;
  region: string;
  district: string | null;
  address: string | null;
  price_per_hour: number;
  capacity: number;
  discount_rate: number | null;
  description: string | null;
  amenities: string[] | null;
  rating: number | string | null;
  review_count: number | null;
  featured: boolean | null;
  time_deal: boolean | null;
  pay_slug: string;
  image_url: string | null;
  image_urls: string[] | null;
  is_hidden: boolean | null;
  approval_status?: string | null;
  rejection_reason?: string | null;
  approved_at?: string | null;
  created_at: string | null;
}

export interface SpacePrivateRow {
  space_id: string;
  detail_address: string | null;
  entry_guide: string | null;
  parking_guide: string | null;
}

export interface SpaceAccountRow {
  space_id: string;
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
}

export interface BookingRow {
  id: string;
  space_id: string;
  space_name: string;
  host_id: string;
  guest_id: string | null;
  guest_name: string;
  guest_phone: string;
  date: string;
  start_time: string;
  hours: number;
  guests: number;
  total_amount: number;
  status: string;
  memo: string | null;
  channel?: string | null;
  source?: string | null;
  refund_status?: string | null;
  access_token_hash?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  expires_at?: string | null;
  pay_bank_name?: string | null;
  pay_account_number?: string | null;
  pay_account_holder?: string | null;
  cancel_reason?: string | null;
  created_at: string | null;
}

export interface BookingEventRow {
  id: string;
  booking_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  actor: string | null;
  memo: string | null;
  created_at: string | null;
}

export function mapProfile(row: ProfileRow): Profile {
  const role: Role = row.role === "host" ? "host" : "guest";
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? row.email.split("@")[0],
    role,
    phone: row.phone ?? "",
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

function mapApproval(row: SpaceRow): ApprovalStatus {
  if (row.approval_status === "approved" || row.approval_status === "rejected") return row.approval_status;
  return "pending_review";
}

export function mapSpace(row: SpaceRow): Space {
  const extraImages = Array.isArray(row.image_urls) ? row.image_urls.filter(Boolean) : [];
  const imageUrls = extraImages.length > 0 ? extraImages : row.image_url ? [row.image_url] : [];
  return {
    id: row.id,
    hostId: row.host_id,
    hostName: row.host_name ?? "이곳저곳 호스트",
    name: row.name,
    category: row.category as Space["category"],
    region: row.region,
    district: row.district ?? "",
    address: row.address ?? "",
    pricePerHour: Number(row.price_per_hour),
    capacity: Number(row.capacity),
    discountRate: Number(row.discount_rate ?? 0),
    description: row.description ?? "",
    amenities: Array.isArray(row.amenities) ? row.amenities : [],
    rating: Number(row.rating ?? 0),
    reviewCount: Number(row.review_count ?? 0),
    featured: Boolean(row.featured),
    timeDeal: Boolean(row.time_deal),
    paySlug: row.pay_slug,
    imageUrl: imageUrls[0] ?? null,
    imageUrls,
    hidden: Boolean(row.is_hidden),
    approvalStatus: mapApproval(row),
    rejectionReason: row.rejection_reason ?? "",
    approvedAt: row.approved_at ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

export function mapSpacePrivate(row: SpacePrivateRow): SpacePrivate {
  return {
    detailAddress: row.detail_address ?? "",
    entryGuide: row.entry_guide ?? "",
    parkingGuide: row.parking_guide ?? "",
  };
}

export function mapBooking(row: BookingRow): Booking {
  const status: BookingStatus =
    row.status === "confirmed" ? "confirmed" : row.status === "cancelled" ? "cancelled" : "pending";
  const cancelReason: CancelReason | null =
    row.cancel_reason === "expired" || row.cancel_reason === "host" || row.cancel_reason === "guest"
      ? row.cancel_reason
      : null;
  const channel: BookingChannel = row.channel === "link" ? "link" : "web";
  const source: BookingSource = row.source === "block" ? "block" : "guest";
  const refundStatus: RefundStatus =
    row.refund_status === "pending" || row.refund_status === "completed" ? row.refund_status : "none";
  return {
    id: row.id,
    spaceId: row.space_id,
    spaceName: row.space_name,
    hostId: row.host_id,
    guestId: row.guest_id,
    guestName: row.guest_name,
    guestPhone: row.guest_phone,
    date: row.date,
    startTime: row.start_time,
    hours: Number(row.hours),
    guests: Number(row.guests),
    totalAmount: Number(row.total_amount),
    status,
    memo: row.memo ?? "",
    channel,
    source,
    refundStatus,
    createdAt: row.created_at ?? new Date().toISOString(),
    expiresAt: row.expires_at ?? null,
    payBankName: row.pay_bank_name ?? "",
    payAccountNumber: row.pay_account_number ?? "",
    payAccountHolder: row.pay_account_holder ?? "",
    cancelReason,
  };
}

export function mapBookingEvent(row: BookingEventRow): BookingEvent {
  return {
    id: row.id,
    bookingId: row.booking_id,
    eventType: row.event_type,
    fromStatus: row.from_status ?? null,
    toStatus: row.to_status ?? null,
    actor: row.actor ?? "system",
    memo: row.memo ?? "",
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}
