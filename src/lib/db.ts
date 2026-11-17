import { makeSlug } from "./format";
import { createSeedBookings, createSeedProfiles, createSeedSpaces, DEMO_PASSWORDS } from "./seed";
import { supabase } from "./supabase";
import type {
  Booking,
  BookingInput,
  BookingStatus,
  Profile,
  Role,
  Space,
  SpaceInput,
} from "./types";

const DB_KEY = "placeon.db.v1";
const SESSION_KEY = "placeon.session.v1";

interface LocalDB {
  profiles: Profile[];
  passwords: Record<string, string>;
  spaces: Space[];
  bookings: Booking[];
}

interface ProfileRow {
  id: string;
  email: string;
  name: string | null;
  role: string | null;
  phone: string | null;
  created_at: string | null;
}

interface SpaceRow {
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

interface BookingRow {
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
  created_at: string | null;
}

/* ------------------------------------------------------------------ */
/* local (demo) storage                                                */
/* ------------------------------------------------------------------ */

function emptyDB(): LocalDB {
  return {
    profiles: createSeedProfiles(),
    passwords: { ...DEMO_PASSWORDS },
    spaces: createSeedSpaces(),
    bookings: createSeedBookings(),
  };
}

function readDB(): LocalDB {
  if (typeof window === "undefined") return emptyDB();
  try {
    const raw = window.localStorage.getItem(DB_KEY);
    if (!raw) {
      const seeded = emptyDB();
      window.localStorage.setItem(DB_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as LocalDB;
    return {
      profiles: parsed.profiles ?? [],
      passwords: parsed.passwords ?? {},
      spaces: parsed.spaces ?? [],
      bookings: parsed.bookings ?? [],
    };
  } catch {
    return emptyDB();
  }
}

function writeDB(db: LocalDB): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    throw new Error(
      "브라우저 저장 공간이 부족해 저장하지 못했어요. 사진 수를 줄이거나 사진을 삭제한 뒤 다시 시도해 주세요."
    );
  }
}

export function resetDemoData(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DB_KEY);
  window.localStorage.removeItem(SESSION_KEY);
}

export function getDemoSession(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SESSION_KEY);
}

function setDemoSession(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(SESSION_KEY, id);
  else window.localStorage.removeItem(SESSION_KEY);
}

function mapProfile(row: ProfileRow): Profile {
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

function mapSpace(row: SpaceRow): Space {
  const extraImages = Array.isArray(row.image_urls) ? row.image_urls.filter(Boolean) : [];
  const imageUrls = extraImages.length > 0 ? extraImages : row.image_url ? [row.image_url] : [];
  return {
    id: row.id,
    hostId: row.host_id,
    hostName: row.host_name ?? "플레이스온 호스트",
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

function mapBooking(row: BookingRow): Booking {
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

function authErrorMessage(message: string): string {
  const map: Record<string, string> = {
    "Invalid login credentials": "이메일 또는 비밀번호가 일치하지 않아요.",
    "Email not confirmed": "이메일 인증이 아직 완료되지 않았어요. 받은 메일의 인증 링크를 눌러 주세요.",
    "User already registered": "이미 가입된 이메일이에요. 로그인해 주세요.",
    "Password should be at least 6 characters": "비밀번호는 6자 이상으로 정해 주세요.",
    "Unable to validate email address: invalid format": "이메일 형식을 확인해 주세요.",
  };
  return map[message] ?? message;
}

/* ------------------------------------------------------------------ */
/* auth                                                                */
/* ------------------------------------------------------------------ */

async function ensureProfile(authUser: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): Promise<Profile> {
  if (!supabase) throw new Error("Supabase가 연결되지 않았어요.");
  const email = authUser.email ?? "";
  const { data } = await supabase.from("profiles").select("*").eq("id", authUser.id).maybeSingle();
  if (data) return mapProfile(data as ProfileRow);

  const meta = authUser.user_metadata ?? {};
  const role: Role = meta.role === "host" ? "host" : "guest";
  const name = typeof meta.name === "string" && meta.name ? meta.name : email.split("@")[0];
  const { data: inserted, error } = await supabase
    .from("profiles")
    .insert({ id: authUser.id, email, name, role, phone: typeof meta.phone === "string" ? meta.phone : "" })
    .select("*")
    .single();
  if (error) {
    throw new Error(`프로필을 불러오지 못했어요. (${error.message})`);
  }
  return mapProfile(inserted as ProfileRow);
}

export async function getSessionProfile(): Promise<Profile | null> {
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;
    return ensureProfile(data.session.user);
  }
  const id = getDemoSession();
  if (!id) return null;
  const profile = readDB().profiles.find((p) => p.id === id);
  return profile ?? null;
}

export async function signInWithEmail(email: string, password: string): Promise<Profile> {
  const normalized = email.trim().toLowerCase();
  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: normalized, password });
    if (error) throw new Error(authErrorMessage(error.message));
    if (!data.user) throw new Error("로그인에 실패했어요. 다시 시도해 주세요.");
    return ensureProfile(data.user);
  }
  const db = readDB();
  const profile = db.profiles.find((p) => p.email.toLowerCase() === normalized);
  if (!profile || db.passwords[profile.email.toLowerCase()] !== password) {
    throw new Error("이메일 또는 비밀번호가 일치하지 않아요.");
  }
  setDemoSession(profile.id);
  return profile;
}

export async function signUpWithEmail(input: {
  email: string;
  password: string;
  name: string;
  role: Role;
  phone?: string;
}): Promise<Profile> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!email.includes("@")) throw new Error("이메일 형식을 확인해 주세요.");
  if (input.password.length < 6) throw new Error("비밀번호는 6자 이상으로 정해 주세요.");
  if (!name) throw new Error("이름을 입력해 주세요.");

  if (supabase) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: input.password,
      options: { data: { name, role: input.role, phone: input.phone ?? "" } },
    });
    if (error) throw new Error(authErrorMessage(error.message));
    if (data.session && data.user) return ensureProfile(data.user);
    const { data: signed, error: signError } = await supabase.auth.signInWithPassword({
      email,
      password: input.password,
    });
    if (signError || !signed.user) {
      throw new Error("가입은 접수됐어요. 메일함에서 인증 링크를 눌러 로그인해 주세요.");
    }
    return ensureProfile(signed.user);
  }

  const db = readDB();
  if (db.profiles.some((p) => p.email.toLowerCase() === email)) {
    throw new Error("이미 가입된 이메일이에요. 로그인해 주세요.");
  }
  const profile: Profile = {
    id: crypto.randomUUID(),
    email,
    name,
    role: input.role,
    phone: input.phone ?? "",
    createdAt: new Date().toISOString(),
  };
  db.profiles.push(profile);
  db.passwords[email] = input.password;
  writeDB(db);
  setDemoSession(profile.id);
  return profile;
}

export async function signOutUser(): Promise<void> {
  if (supabase) {
    await supabase.auth.signOut();
    return;
  }
  setDemoSession(null);
}

/* ------------------------------------------------------------------ */
/* spaces                                                              */
/* ------------------------------------------------------------------ */

export async function fetchSpaces(): Promise<Space[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("spaces")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`공간 목록을 불러오지 못했어요. (${error.message})`);
    return ((data ?? []) as SpaceRow[]).map(mapSpace);
  }
  return readDB().spaces.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function spaceRowPayload(input: SpaceInput, host: Profile) {
  return {
    host_id: host.id,
    host_name: host.name,
    name: input.name,
    category: input.category,
    region: input.region,
    district: input.district,
    address: input.address,
    price_per_hour: input.pricePerHour,
    capacity: input.capacity,
    discount_rate: input.discountRate,
    description: input.description,
    amenities: input.amenities,
    featured: input.featured ?? false,
    time_deal: input.timeDeal ?? input.discountRate > 0,
    image_url: input.imageUrls?.[0] ?? null,
    image_urls: input.imageUrls ?? [],
    is_hidden: input.hidden ?? false,
  };
}

export async function insertSpace(input: SpaceInput, host: Profile): Promise<Space> {
  if (supabase) {
    const { data, error } = await supabase
      .from("spaces")
      .insert({ ...spaceRowPayload(input, host), pay_slug: makeSlug() })
      .select("*")
      .single();
    if (error) throw new Error(`공간을 등록하지 못했어요. (${error.message})`);
    return mapSpace(data as SpaceRow);
  }
  const db = readDB();
  const space: Space = {
    id: crypto.randomUUID(),
    hostId: host.id,
    hostName: host.name,
    name: input.name,
    category: input.category,
    region: input.region,
    district: input.district,
    address: input.address,
    pricePerHour: input.pricePerHour,
    capacity: input.capacity,
    discountRate: input.discountRate,
    description: input.description,
    amenities: input.amenities,
    rating: 0,
    reviewCount: 0,
    featured: input.featured ?? false,
    timeDeal: input.timeDeal ?? input.discountRate > 0,
    paySlug: makeSlug(),
    imageUrl: input.imageUrls?.[0] ?? null,
    imageUrls: input.imageUrls ?? [],
    hidden: input.hidden ?? false,
    createdAt: new Date().toISOString(),
  };
  db.spaces.unshift(space);
  writeDB(db);
  return space;
}

export async function patchSpace(
  id: string,
  patch: Partial<SpaceInput> & { featured?: boolean; timeDeal?: boolean }
): Promise<Space | null> {
  if (supabase) {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.category !== undefined) row.category = patch.category;
    if (patch.region !== undefined) row.region = patch.region;
    if (patch.district !== undefined) row.district = patch.district;
    if (patch.address !== undefined) row.address = patch.address;
    if (patch.pricePerHour !== undefined) row.price_per_hour = patch.pricePerHour;
    if (patch.capacity !== undefined) row.capacity = patch.capacity;
    if (patch.discountRate !== undefined) row.discount_rate = patch.discountRate;
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.amenities !== undefined) row.amenities = patch.amenities;
    if (patch.featured !== undefined) row.featured = patch.featured;
    if (patch.timeDeal !== undefined) row.time_deal = patch.timeDeal;
    if (patch.imageUrls !== undefined) {
      row.image_urls = patch.imageUrls;
      row.image_url = patch.imageUrls[0] ?? null;
    }
    if (patch.hidden !== undefined) row.is_hidden = patch.hidden;
    const { data, error } = await supabase.from("spaces").update(row).eq("id", id).select("*").single();
    if (error) throw new Error(`공간 정보를 수정하지 못했어요. (${error.message})`);
    return mapSpace(data as SpaceRow);
  }
  const db = readDB();
  const index = db.spaces.findIndex((s) => s.id === id);
  if (index < 0) return null;
  const updated: Space = { ...db.spaces[index], ...patch };
  db.spaces[index] = updated;
  writeDB(db);
  return updated;
}

export async function removeSpace(id: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from("spaces").delete().eq("id", id);
    if (error) throw new Error(`공간을 삭제하지 못했어요. (${error.message})`);
    return;
  }
  const db = readDB();
  db.spaces = db.spaces.filter((s) => s.id !== id);
  db.bookings = db.bookings.filter((b) => b.spaceId !== id);
  writeDB(db);
}

/* ------------------------------------------------------------------ */
/* bookings                                                            */
/* ------------------------------------------------------------------ */

export async function fetchBookings(user: Profile): Promise<Booking[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`예약 내역을 불러오지 못했어요. (${error.message})`);
    return ((data ?? []) as BookingRow[])
      .map(mapBooking)
      .filter((b) => b.guestId === user.id || b.hostId === user.id);
  }
  return readDB()
    .bookings.filter((b) => b.guestId === user.id || b.hostId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function insertBooking(input: BookingInput, user: Profile | null): Promise<Booking> {
  const { space } = input;
  const gross = space.pricePerHour * input.hours;
  const totalAmount = Math.round((gross * (100 - space.discountRate)) / 100);

  if (supabase) {
    const { data, error } = await supabase
      .from("bookings")
      .insert({
        space_id: space.id,
        space_name: space.name,
        host_id: space.hostId,
        guest_id: user?.id ?? null,
        guest_name: input.guestName,
        guest_phone: input.guestPhone,
        date: input.date,
        start_time: input.startTime,
        hours: input.hours,
        guests: input.guests,
        total_amount: totalAmount,
        status: "pending",
        memo: input.memo ?? "",
        source: input.source ?? "web",
      })
      .select("*")
      .single();
    if (error) throw new Error(`예약을 접수하지 못했어요. (${error.message})`);
    return mapBooking(data as BookingRow);
  }

  const db = readDB();
  const booking: Booking = {
    id: crypto.randomUUID(),
    spaceId: space.id,
    spaceName: space.name,
    hostId: space.hostId,
    guestId: user?.id ?? null,
    guestName: input.guestName,
    guestPhone: input.guestPhone,
    date: input.date,
    startTime: input.startTime,
    hours: input.hours,
    guests: input.guests,
    totalAmount,
    status: "pending",
    memo: input.memo ?? "",
    source: input.source ?? "web",
    createdAt: new Date().toISOString(),
  };
  db.bookings.unshift(booking);
  writeDB(db);
  return booking;
}

export async function updateBookingStatus(id: string, status: BookingStatus): Promise<Booking | null> {
  if (supabase) {
    const { data, error } = await supabase
      .from("bookings")
      .update({ status })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(`예약 상태를 바꾸지 못했어요. (${error.message})`);
    return mapBooking(data as BookingRow);
  }
  const db = readDB();
  const index = db.bookings.findIndex((b) => b.id === id);
  if (index < 0) return null;
  db.bookings[index] = { ...db.bookings[index], status };
  writeDB(db);
  return db.bookings[index];
}
