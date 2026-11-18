import { makeSlug } from "./format";
import { mapBooking, mapProfile, mapSpace, type BookingRow, type ProfileRow, type SpaceRow } from "./mappers";
import { createSeedBookings, createSeedProfiles, createSeedSpaces, DEMO_PASSWORDS } from "./seed";
import { supabase } from "./supabase";
import type {
  BankAccount,
  Booking,
  BookingInput,
  BookingStatus,
  CancelReason,
  Profile,
  Role,
  Space,
  SpaceInput,
} from "./types";

const DB_KEY = "placeon.db.v1";
const SESSION_KEY = "placeon.session.v1";
/** 입금 기한(분) — DB 의 create_booking RPC(now() + 15분)와 같은 값이어야 한다. */
export const DEPOSIT_WINDOW_MINUTES = 15;

interface LocalDB {
  profiles: Profile[];
  passwords: Record<string, string>;
  spaces: Space[];
  bookings: Booking[];
  /** spaceId → 입금 계좌 (미리보기 모드 전용) */
  accounts: Record<string, BankAccount>;
}

/* ------------------------------------------------------------------ */
/* local (demo) storage                                                */
/* ------------------------------------------------------------------ */

function emptyDB(): LocalDB {
  const spaces = createSeedSpaces();
  const accounts: Record<string, BankAccount> = {};
  for (const space of spaces) {
    accounts[space.id] = { bankName: "국민은행", accountNumber: "123-45-678901", accountHolder: space.hostName };
  }
  return {
    profiles: createSeedProfiles(),
    passwords: { ...DEMO_PASSWORDS },
    spaces,
    bookings: createSeedBookings(),
    accounts,
  };
}

/** 지난 pending 예약을 cancelled(사유 expired)로 정리한다. (미리보기 모드) */
function sweepExpiredBookings(db: LocalDB): boolean {
  const now = Date.now();
  let changed = false;
  for (const booking of db.bookings) {
    if (booking.status !== "pending") continue;
    const limit = booking.expiresAt ? new Date(booking.expiresAt).getTime() : null;
    const started = booking.date && booking.startTime ? new Date(`${booking.date}T${booking.startTime}:00`).getTime() : null;
    if ((limit !== null && limit < now) || (started !== null && started < now)) {
      booking.status = "cancelled";
      booking.cancelReason = "expired";
      changed = true;
    }
  }
  return changed;
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
    const db: LocalDB = {
      profiles: parsed.profiles ?? [],
      passwords: parsed.passwords ?? {},
      spaces: parsed.spaces ?? [],
      bookings: parsed.bookings ?? [],
      accounts: parsed.accounts ?? {},
    };
    if (sweepExpiredBookings(db)) writeDB(db);
    return db;
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

/* ------------------------------------------------------------------ */
/* space accounts (사장님 입금 계좌)                                    */
/* ------------------------------------------------------------------ */

function accountFromInput(input: Partial<SpaceInput>): BankAccount | null {
  if (input.bankName === undefined && input.accountNumber === undefined && input.accountHolder === undefined) {
    return null;
  }
  return {
    bankName: (input.bankName ?? "").trim(),
    accountNumber: (input.accountNumber ?? "").trim(),
    accountHolder: (input.accountHolder ?? "").trim(),
  };
}

/**
 * 내가 관리하는 공간의 입금 계좌 목록 (spaceId → 계좌).
 * Supabase 모드에서는 RLS(`space_accounts_select_owner`)가 본인·관리자 범위만 돌려준다.
 */
export async function fetchSpaceAccounts(): Promise<Record<string, BankAccount>> {
  if (supabase) {
    const { data, error } = await supabase.from("space_accounts").select("*");
    if (error) {
      console.error("[db] 입금 계좌를 불러오지 못했어요.", error);
      return {};
    }
    const map: Record<string, BankAccount> = {};
    for (const row of data ?? []) {
      map[row.space_id as string] = {
        bankName: row.bank_name ?? "",
        accountNumber: row.account_number ?? "",
        accountHolder: row.account_holder ?? "",
      };
    }
    return map;
  }
  return readDB().accounts;
}

/** 공간별 입금 계좌 저장 (비우면 계좌 미등록 상태가 된다). */
export async function saveSpaceAccount(spaceId: string, account: BankAccount): Promise<void> {
  const bankName = account.bankName.trim();
  const accountNumber = account.accountNumber.trim();
  const accountHolder = account.accountHolder.trim();

  if (supabase) {
    if (!bankName && !accountNumber && !accountHolder) {
      const { error } = await supabase.from("space_accounts").delete().eq("space_id", spaceId);
      if (error) throw new Error(`입금 계좌를 삭제하지 못했어요. (${error.message})`);
      return;
    }
    const { error } = await supabase.from("space_accounts").upsert(
      {
        space_id: spaceId,
        bank_name: bankName,
        account_number: accountNumber,
        account_holder: accountHolder,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "space_id" }
    );
    if (error) throw new Error(`입금 계좌를 저장하지 못했어요. (${error.message})`);
    return;
  }

  const db = readDB();
  if (!bankName && !accountNumber && !accountHolder) {
    delete db.accounts[spaceId];
  } else {
    db.accounts[spaceId] = { bankName, accountNumber, accountHolder };
  }
  writeDB(db);
}

export async function insertSpace(input: SpaceInput, host: Profile): Promise<Space> {
  const account = accountFromInput(input);
  if (supabase) {
    const { data, error } = await supabase
      .from("spaces")
      .insert({ ...spaceRowPayload(input, host), pay_slug: makeSlug() })
      .select("*")
      .single();
    if (error) throw new Error(`공간을 등록하지 못했어요. (${error.message})`);
    const created = mapSpace(data as SpaceRow);
    if (account) {
      try {
        await saveSpaceAccount(created.id, account);
      } catch (accountError) {
        console.error("[db] 입금 계좌 저장 실패", accountError);
        throw accountError;
      }
    }
    return created;
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
  if (account) db.accounts[space.id] = account;
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
    const account = accountFromInput(patch);
    if (account) await saveSpaceAccount(id, account);
    return mapSpace(data as SpaceRow);
  }
  const db = readDB();
  const index = db.spaces.findIndex((s) => s.id === id);
  if (index < 0) return null;
  const updated: Space = { ...db.spaces[index], ...patch };
  db.spaces[index] = updated;
  const account = accountFromInput(patch);
  if (account) {
    if (!account.bankName && !account.accountNumber && !account.accountHolder) delete db.accounts[id];
    else db.accounts[id] = account;
  }
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
    // 예약 생성은 서버 API 한 곳에서만: 금액 재계산 · 더블부킹 차단 · 만료 pending 정리.
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        spaceId: space.id,
        paySlug: space.paySlug,
        source: input.source ?? "web",
        date: input.date,
        startTime: input.startTime,
        hours: input.hours,
        guests: input.guests,
        guestName: input.guestName,
        guestPhone: input.guestPhone,
        memo: input.memo ?? "",
      }),
    });

    let payload: { booking?: BookingRow; error?: string } | null = null;
    try {
      payload = (await response.json()) as { booking?: BookingRow; error?: string };
    } catch {
      payload = null;
    }

    if (!response.ok || !payload?.booking) {
      throw new Error(payload?.error ?? "예약을 접수하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }

    return mapBooking(payload.booking);
  }

  const db = readDB();
  const account = db.accounts[space.id];
  const now = Date.now();
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
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + DEPOSIT_WINDOW_MINUTES * 60 * 1000).toISOString(),
    payBankName: account?.bankName ?? "",
    payAccountNumber: account?.accountNumber ?? "",
    payAccountHolder: account?.accountHolder ?? "",
    cancelReason: null,
  };
  db.bookings.unshift(booking);
  writeDB(db);
  return booking;
}

/* ------------------------------------------------------------------ */
/* admin (총괄 관리자)                                                  */
/* ------------------------------------------------------------------ */

export interface AdminData {
  spaces: Space[];
  bookings: Booking[];
  profiles: Profile[];
}

/**
 * 관리자 화면용 전체 데이터.
 * Supabase 모드에서는 RLS 정책(`is_admin()`)이 관리자에게만 전체 행을 내려주고,
 * 일반 사용자·비로그인 상태에서는 요청해도 본인 권한 범위 밖의 행이 오지 않는다.
 */
export async function fetchAdminData(): Promise<AdminData> {
  if (supabase) {
    const [spaceRes, bookingRes, profileRes] = await Promise.all([
      supabase.from("spaces").select("*").order("created_at", { ascending: false }),
      supabase.from("bookings").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    ]);
    const error = spaceRes.error ?? bookingRes.error ?? profileRes.error;
    if (error) throw new Error(`관리자 데이터를 불러오지 못했어요. (${error.message})`);
    return {
      spaces: ((spaceRes.data ?? []) as SpaceRow[]).map(mapSpace),
      bookings: ((bookingRes.data ?? []) as BookingRow[]).map(mapBooking),
      profiles: ((profileRes.data ?? []) as ProfileRow[]).map(mapProfile),
    };
  }

  const db = readDB();
  return {
    spaces: db.spaces.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    bookings: db.bookings
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    profiles: db.profiles.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

export async function updateBookingStatus(
  id: string,
  status: BookingStatus,
  reason: CancelReason | null = null
): Promise<Booking | null> {
  if (supabase) {
    // 상태 변경은 서버 API 한 곳에서: 권한 확인 + 사장님 알림 메일 + 만료 기한 재설정.
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("로그인이 끝났어요. 다시 로그인해 주세요.");

    const response = await fetch("/api/bookings/status", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ bookingId: id, status, reason }),
    });

    let payload: { booking?: BookingRow; error?: string } | null = null;
    try {
      payload = (await response.json()) as { booking?: BookingRow; error?: string };
    } catch {
      payload = null;
    }
    if (!response.ok || !payload?.booking) {
      throw new Error(payload?.error ?? "예약 상태를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
    return mapBooking(payload.booking);
  }

  const db = readDB();
  const index = db.bookings.findIndex((b) => b.id === id);
  if (index < 0) return null;
  const current = db.bookings[index];
  db.bookings[index] = {
    ...current,
    status,
    cancelReason: status === "cancelled" ? (reason ?? "host") : null,
    expiresAt:
      status === "pending"
        ? new Date(Date.now() + DEPOSIT_WINDOW_MINUTES * 60 * 1000).toISOString()
        : current.expiresAt,
  };
  writeDB(db);
  return db.bookings[index];
}
