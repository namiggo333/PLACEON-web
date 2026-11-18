import type { Booking, BookingStatus, Profile, Role, Space } from "./types";

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
  created_at: string | null;
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
  source: string;
  start_at?: string | null;
  end_at?: string | null;
  expires_at?: string | null;
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
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

export function mapBooking(row: BookingRow): Booking {
  const status: BookingStatus =
    row.status === "confirmed" ? "confirmed" : row.status === "cancelled" ? "cancelled" : "pending";
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
    source: row.source === "link" ? "link" : "web",
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}
