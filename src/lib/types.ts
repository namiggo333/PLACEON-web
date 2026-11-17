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

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone: string;
  createdAt: string;
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
