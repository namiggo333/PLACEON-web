import { makeSlug } from "./format";
import {
  mapBooking,
  mapBookingEvent,
  mapItemWaitlist,
  mapProfile,
  mapSpace,
  mapSpacePrivate,
  type BookingEventRow,
  type BookingRow,
  type ItemWaitlistRow,
  type ProfileRow,
  type SpacePrivateRow,
  type SpaceRow,
} from "./mappers";
import { createSeedBookings, createSeedProfiles, createSeedSpaces, DEMO_PASSWORDS } from "./seed";
import { supabase } from "./supabase";
import type {
  ApprovalStatus,
  BankAccount,
  Booking,
  BookingEvent,
  BookingInput,
  BookingStatus,
  RefundStatus,
  CancelReason,
  ItemWaitlistEntry,
  Profile,
  Role,
  Space,
  SpaceInput,
  SpacePrivate,
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
  /** spaceId → 상세주소·출입 안내 (미리보기 모드 전용) */
  privateInfo: Record<string, SpacePrivate>;
  events: BookingEvent[];
  /** bookingId → 비로그인 예약 확인 토큰 (미리보기 모드 전용) */
  tokens: Record<string, string>;
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
    privateInfo: {},
    events: [],
    tokens: {},
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
      privateInfo: parsed.privateInfo ?? {},
      events: parsed.events ?? [],
      tokens: parsed.tokens ?? {},
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
    try {
      const privateInfo = privateFromInput(input);
      if (privateInfo) await saveSpacePrivate(created.id, privateInfo);
    } catch (privateError) {
      console.error("[db] 상세주소·출입 안내 저장 실패", privateError);
      throw privateError;
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
    // 미리보기 모드에서는 관리자 검수를 거치지 않고 바로 공개한다.
    approvalStatus: "approved",
    rejectionReason: "",
    approvedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  db.spaces.unshift(space);
  if (account) db.accounts[space.id] = account;
  const privateInfo = privateFromInput(input);
  if (privateInfo) db.privateInfo[space.id] = privateInfo;
  writeDB(db);
  return space;
}

/* ------------------------------------------------------------------ */
/* space private info (확정 후 공개되는 상세주소·출입 안내)               */
/* ------------------------------------------------------------------ */

function privateFromInput(input: Partial<SpaceInput>): SpacePrivate | null {
  if (input.detailAddress === undefined && input.entryGuide === undefined && input.parkingGuide === undefined) {
    return null;
  }
  return {
    detailAddress: (input.detailAddress ?? "").trim(),
    entryGuide: (input.entryGuide ?? "").trim(),
    parkingGuide: (input.parkingGuide ?? "").trim(),
  };
}

/** 내가 관리하는 공간의 상세주소·출입 안내 (RLS 로 사장님·관리자만 조회) */
export async function fetchSpacePrivate(spaceId: string): Promise<SpacePrivate | null> {
  if (supabase) {
    const { data, error } = await supabase
      .from("spaces_private")
      .select("*")
      .eq("space_id", spaceId)
      .maybeSingle();
    if (error) {
      console.error("[db] 상세 정보를 불러오지 못했어요.", error);
      return null;
    }
    return data ? mapSpacePrivate(data as SpacePrivateRow) : null;
  }
  return readDB().privateInfo[spaceId] ?? null;
}

/** 상세주소·출입 안내 저장 (비우면 삭제) */
export async function saveSpacePrivate(spaceId: string, info: SpacePrivate): Promise<void> {
  const detailAddress = info.detailAddress.trim();
  const entryGuide = info.entryGuide.trim();
  const parkingGuide = info.parkingGuide.trim();
  const empty = !detailAddress && !entryGuide && !parkingGuide;

  if (supabase) {
    if (empty) {
      const { error } = await supabase.from("spaces_private").delete().eq("space_id", spaceId);
      if (error) throw new Error(`상세 정보를 삭제하지 못했어요. (${error.message})`);
      return;
    }
    const { error } = await supabase.from("spaces_private").upsert(
      {
        space_id: spaceId,
        detail_address: detailAddress,
        entry_guide: entryGuide,
        parking_guide: parkingGuide,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "space_id" }
    );
    if (error) throw new Error(`상세 정보를 저장하지 못했어요. (${error.message})`);
    return;
  }

  const db = readDB();
  if (empty) delete db.privateInfo[spaceId];
  else db.privateInfo[spaceId] = { detailAddress, entryGuide, parkingGuide };
  writeDB(db);
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
    const privateInfo = privateFromInput(patch);
    if (privateInfo) await saveSpacePrivate(id, privateInfo);
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
    // 미리보기 모드에서도 계좌를 바꾸면 재검수 대기로 돌린다.
    db.spaces[index].approvalStatus = "pending_review";
    db.spaces[index].approvedAt = null;
  }
  const privateInfo = privateFromInput(patch);
  if (privateInfo) db.privateInfo[id] = privateInfo;
  writeDB(db);
  return db.spaces[index];
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
  delete db.privateInfo[id];
  delete db.accounts[id];
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
        channel: input.channel ?? "web",
        date: input.date,
        startTime: input.startTime,
        hours: input.hours,
        guests: input.guests,
        guestName: input.guestName,
        guestPhone: input.guestPhone,
        memo: input.memo ?? "",
      }),
    });

    let payload: { booking?: BookingRow; error?: string; accessToken?: string } | null = null;
    try {
      payload = (await response.json()) as { booking?: BookingRow; error?: string; accessToken?: string };
    } catch {
      payload = null;
    }

    if (!response.ok || !payload?.booking) {
      throw new Error(payload?.error ?? "예약을 접수하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }

    const booking = mapBooking(payload.booking);
    if (payload.accessToken) {
      saveBookingToken(booking.id, payload.accessToken);
      booking.accessToken = payload.accessToken;
    }
    return booking;
  }

  const db = readDB();
  const account = db.accounts[space.id];
  const now = Date.now();
  const accessToken = makeAccessToken();
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
    channel: input.channel ?? "web",
    source: "guest",
    refundStatus: "none",
    accessToken,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + DEPOSIT_WINDOW_MINUTES * 60 * 1000).toISOString(),
    payBankName: account?.bankName ?? "",
    payAccountNumber: account?.accountNumber ?? "",
    payAccountHolder: account?.accountHolder ?? "",
    cancelReason: null,
  };
  db.bookings.unshift(booking);
  db.tokens[booking.id] = accessToken;
  db.events.unshift({
    id: crypto.randomUUID(),
    bookingId: booking.id,
    eventType: "created",
    fromStatus: null,
    toStatus: "pending",
    actor: "guest",
    memo: "",
    createdAt: booking.createdAt,
  });
  writeDB(db);
  return booking;
}

/* ------------------------------------------------------------------ */
/* 예약 확인 토큰 · 변경 이력                                            */
/* ------------------------------------------------------------------ */

const TOKEN_KEY = "placeon.access.v1";

function makeAccessToken(): string {
  const bytes = new Uint8Array(18);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 비로그인 예약 확인 토큰을 이 브라우저에 보관한다(서버에는 해시만 남는다). */
export function saveBookingToken(bookingId: string, token: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(TOKEN_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[bookingId] = token;
    window.localStorage.setItem(TOKEN_KEY, JSON.stringify(map));
  } catch {
    /* 저장 공간이 없으면 링크로만 확인할 수 있다 */
  }
}

export function getBookingToken(bookingId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[bookingId] ?? null;
  } catch {
    return null;
  }
}

/** 내가 볼 수 있는 예약의 변경 이력 (RLS: 예약자·사장님·관리자) */
export async function fetchBookingEvents(): Promise<BookingEvent[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("booking_events")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[db] 예약 이력을 불러오지 못했어요.", error);
      return [];
    }
    return ((data ?? []) as BookingEventRow[]).map(mapBookingEvent);
  }
  return readDB().events.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/* ------------------------------------------------------------------ */
/* admin (총괄 관리자)                                                  */
/* ------------------------------------------------------------------ */

export interface AdminData {
  spaces: Space[];
  bookings: Booking[];
  profiles: Profile[];
  /** 이곳저곳 Item 사전 수요조사 (관리자만 조회) */
  itemWaitlist: ItemWaitlistEntry[];
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

    // Item 수요조사는 아직 테이블이 없거나 RLS 로 막힌 경우에도 관리자 화면 전체가 죽지 않게 따로 읽는다.
    let itemWaitlist: ItemWaitlistEntry[] = [];
    try {
      const { data: waitlistRows, error: waitlistError } = await supabase
        .from("item_waitlist")
        .select("*")
        .order("created_at", { ascending: false });
      if (waitlistError) throw waitlistError;
      itemWaitlist = ((waitlistRows ?? []) as ItemWaitlistRow[]).map(mapItemWaitlist);
    } catch (waitlistError) {
      console.warn("[db] Item 수요조사를 불러오지 못했어요.", waitlistError);
    }

    return {
      spaces: ((spaceRes.data ?? []) as SpaceRow[]).map(mapSpace),
      bookings: ((bookingRes.data ?? []) as BookingRow[]).map(mapBooking),
      profiles: ((profileRes.data ?? []) as ProfileRow[]).map(mapProfile),
      itemWaitlist,
    };
  }

  const db = readDB();
  return {
    spaces: db.spaces.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    bookings: db.bookings
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    profiles: db.profiles.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    itemWaitlist: [],
  };
}

/** 관리자 화면에서 Item 수요조사 한 건을 삭제한다. */
export async function removeItemWaitlist(id: string): Promise<void> {
  if (!supabase) return;
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("로그인이 끝났어요. 다시 로그인해 주세요.");

  const response = await fetch("/api/admin/item-waitlist", {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ id }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "수요조사를 삭제하지 못했어요.");
  }
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
  const nextRefund: RefundStatus =
    status === "cancelled" && current.status === "confirmed" && current.refundStatus === "none"
      ? "pending"
      : current.refundStatus;
  db.bookings[index] = {
    ...current,
    status,
    cancelReason: status === "cancelled" ? (reason ?? "host") : null,
    refundStatus: nextRefund,
    expiresAt:
      status === "pending"
        ? new Date(Date.now() + DEPOSIT_WINDOW_MINUTES * 60 * 1000).toISOString()
        : current.expiresAt,
  };
  if (current.status !== status) {
    db.events.push({
      id: crypto.randomUUID(),
      bookingId: id,
      eventType:
        status === "confirmed"
          ? "confirmed"
          : status === "cancelled"
            ? reason === "expired"
              ? "expired"
              : reason === "guest"
                ? "cancelled"
                : "rejected"
            : "reopened",
      fromStatus: current.status,
      toStatus: status,
      actor: reason === "guest" ? "guest" : "host",
      memo: reason ?? "",
      createdAt: new Date().toISOString(),
    });
  }
  writeDB(db);
  return db.bookings[index];
}

/** 환불 처리 상태 변경 (사장님·관리자) */
export async function updateRefundStatus(
  id: string,
  refundStatus: RefundStatus,
  memo = ""
): Promise<Booking | null> {
  if (supabase) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("로그인이 끝났어요. 다시 로그인해 주세요.");

    const response = await fetch("/api/bookings/status", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ bookingId: id, refundStatus, memo }),
    });
    const payload = (await response.json().catch(() => null)) as { booking?: BookingRow; error?: string } | null;
    if (!response.ok || !payload?.booking) {
      throw new Error(payload?.error ?? "환불 상태를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
    return mapBooking(payload.booking);
  }

  const db = readDB();
  const index = db.bookings.findIndex((b) => b.id === id);
  if (index < 0) return null;
  db.bookings[index] = { ...db.bookings[index], refundStatus };
  db.events.push({
    id: crypto.randomUUID(),
    bookingId: id,
    eventType: refundStatus === "completed" ? "refund_completed" : "refund_pending",
    fromStatus: db.bookings[index].status,
    toStatus: db.bookings[index].status,
    actor: "host",
    memo,
    createdAt: new Date().toISOString(),
  });
  writeDB(db);
  return db.bookings[index];
}

/** 관리자 공간 승인/반려 */
export async function setSpaceApproval(
  spaceId: string,
  status: ApprovalStatus,
  reason = ""
): Promise<Space | null> {
  if (supabase) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("로그인이 끝났어요. 다시 로그인해 주세요.");

    const response = await fetch("/api/admin/spaces/approval", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ spaceId, status, reason }),
    });
    const payload = (await response.json().catch(() => null)) as { space?: SpaceRow; error?: string } | null;
    if (!response.ok || !payload?.space) {
      throw new Error(payload?.error ?? "승인 상태를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
    return mapSpace(payload.space);
  }

  const db = readDB();
  const index = db.spaces.findIndex((s) => s.id === spaceId);
  if (index < 0) return null;
  db.spaces[index] = {
    ...db.spaces[index],
    approvalStatus: status,
    rejectionReason: status === "rejected" ? reason : "",
    approvedAt: status === "approved" ? new Date().toISOString() : null,
  };
  writeDB(db);
  return db.spaces[index];
}

/* ------------------------------------------------------------------ */
/* 사장님 시간 차단                                                     */
/* ------------------------------------------------------------------ */

export interface BlockInput {
  spaceId: string;
  date: string;
  startTime: string;
  hours: number;
  memo?: string;
}

export interface BulkBlockItem {
  date: string;
  startTime: string;
  hours: number;
  memo?: string;
}

export interface BulkBlockResult {
  index: number;
  ok: boolean;
  bookingId?: string;
  error?: string;
}

/**
 * 여러 건의 외부 일정을 한 번에 시간 차단으로 등록한다.
 * - Supabase 모드: /api/host/blocks 의 bulk 액션이 create_space_block RPC 를 건별로 호출하고
 *   건별 결과(성공/실패 사유)를 돌려준다.
 * - 미리보기 모드: 같은 규칙으로 하나짜리 차단을 반복 등록한다.
 */
export async function createSpaceBlocksBulk(
  spaceId: string,
  items: BulkBlockItem[]
): Promise<BulkBlockResult[]> {
  if (supabase) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("로그인이 끝났어요. 다시 로그인해 주세요.");

    const response = await fetch("/api/host/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "bulk", spaceId, items }),
    });
    const payload = (await response.json().catch(() => null)) as
      | { results?: BulkBlockResult[]; error?: string }
      | null;
    if (!response.ok || !payload?.results) {
      throw new Error(payload?.error ?? "일괄 등록에 실패했어요. 잠시 후 다시 시도해 주세요.");
    }
    return payload.results;
  }

  const results: BulkBlockResult[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    try {
      await createSpaceBlock({ spaceId, ...item });
      results.push({ index, ok: true });
    } catch (error) {
      results.push({ index, ok: false, error: error instanceof Error ? error.message : "등록하지 못했어요." });
    }
  }
  return results;
}

/** 사장님이 원하는 시간대를 차단한다 (bookings.source = 'block'). */
export async function createSpaceBlock(input: BlockInput): Promise<Booking> {
  if (supabase) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("로그인이 끝났어요. 다시 로그인해 주세요.");

    const response = await fetch("/api/host/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "create", ...input }),
    });
    const payload = (await response.json().catch(() => null)) as { booking?: BookingRow; error?: string } | null;
    if (!response.ok || !payload?.booking) {
      throw new Error(payload?.error ?? "시간을 차단하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
    return mapBooking(payload.booking);
  }

  const db = readDB();
  const space = db.spaces.find((s) => s.id === input.spaceId);
  if (!space) throw new Error("공간을 찾을 수 없어요.");
  const start = new Date(`${input.date}T${input.startTime}:00+09:00`).getTime();
  const end = start + input.hours * 60 * 60 * 1000;
  const clash = db.bookings.find(
    (b) =>
      b.spaceId === input.spaceId &&
      b.status !== "cancelled" &&
      new Date(`${b.date}T${b.startTime}:00+09:00`).getTime() < end &&
      start < new Date(`${b.date}T${b.startTime}:00+09:00`).getTime() + b.hours * 3600000
  );
  if (clash) throw new Error("그 시간대에 이미 예약이나 차단이 있어요. 다른 시간을 선택해 주세요.");

  const booking: Booking = {
    id: crypto.randomUUID(),
    spaceId: space.id,
    spaceName: space.name,
    hostId: space.hostId,
    guestId: null,
    guestName: "(사장님 시간 차단)",
    guestPhone: "-",
    date: input.date,
    startTime: input.startTime,
    hours: input.hours,
    guests: 1,
    totalAmount: 0,
    status: "confirmed",
    memo: input.memo ?? "",
    channel: "web",
    source: "block",
    refundStatus: "none",
    createdAt: new Date().toISOString(),
    expiresAt: null,
    payBankName: "",
    payAccountNumber: "",
    payAccountHolder: "",
    cancelReason: null,
  };
  db.bookings.unshift(booking);
  db.events.push({
    id: crypto.randomUUID(),
    bookingId: booking.id,
    eventType: "blocked",
    fromStatus: null,
    toStatus: "confirmed",
    actor: "host",
    memo: booking.memo,
    createdAt: booking.createdAt,
  });
  writeDB(db);
  return booking;
}

/** 사장님이 걸어 둔 시간 차단을 해제한다. */
export async function releaseSpaceBlock(bookingId: string): Promise<Booking | null> {
  if (supabase) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("로그인이 끝났어요. 다시 로그인해 주세요.");

    const response = await fetch("/api/host/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "release", bookingId }),
    });
    const payload = (await response.json().catch(() => null)) as { booking?: BookingRow; error?: string } | null;
    if (!response.ok || !payload?.booking) {
      throw new Error(payload?.error ?? "차단을 해제하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
    return mapBooking(payload.booking);
  }

  const db = readDB();
  const index = db.bookings.findIndex((b) => b.id === bookingId && b.source === "block");
  if (index < 0) return null;
  db.bookings[index] = { ...db.bookings[index], status: "cancelled", cancelReason: "host" };
  db.events.push({
    id: crypto.randomUUID(),
    bookingId,
    eventType: "unblocked",
    fromStatus: "confirmed",
    toStatus: "cancelled",
    actor: "host",
    memo: "",
    createdAt: new Date().toISOString(),
  });
  writeDB(db);
  return db.bookings[index];
}
