"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  claimDeposit,
  createSpaceBlock,
  fetchBookingEvents,
  fetchBookings,
  fetchSpaces,
  fetchSpaceAccounts,
  fetchSpacePrivate,
  getSessionProfile,
  insertBooking,
  insertSpace,
  patchSpace,
  releaseSpaceBlock,
  removeSpace,
  saveSpaceAccount,
  saveSpacePrivate,
  setSpaceApproval,
  signInWithEmail,
  signOutUser,
  signUpWithEmail,
  updateBookingStatus,
  updateRefundStatus,
  resetDemoData,
  type BlockInput,
  type BulkBlockItem,
  type BulkBlockResult,
  createSpaceBlocksBulk,
} from "@/lib/db";
import { dataMode } from "@/lib/supabase";
import { revalidateHomeCache } from "@/lib/revalidate";
import { DEMO_ACCOUNTS } from "@/lib/constants";
import type {
  ApprovalStatus,
  BankAccount,
  Booking,
  BookingEvent,
  BookingInput,
  BookingStatus,
  CancelReason,
  Profile,
  RefundStatus,
  Role,
  Space,
  SpaceInput,
  SpacePrivate,
} from "@/lib/types";

interface AppContextValue {
  ready: boolean;
  mode: "demo" | "supabase";
  user: Profile | null;
  spaces: Space[];
  /** 손님에게 보여지는 공간 목록 (비공개 처리한 공간은 사장님 본인에게만 남는다) */
  visibleSpaces: Space[];
  bookings: Booking[];
  /** 내가 볼 수 있는 예약의 상태 변경 이력 */
  bookingEvents: BookingEvent[];
  /** 공간별 사장님 입금 계좌 (spaceId → 계좌), 권한이 있는 공간만 내려온다 */
  spaceAccounts: Record<string, BankAccount>;
  accountFor: (spaceId: string) => BankAccount | null;
  signIn: (email: string, password: string) => Promise<Profile>;
  signUp: (input: { email: string; password: string; name: string; role: Role; phone?: string }) => Promise<Profile>;
  demoSignIn: (role: Role) => Promise<Profile>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  createSpace: (input: SpaceInput) => Promise<Space>;
  updateSpace: (
    id: string,
    patch: Partial<SpaceInput> & { featured?: boolean; timeDeal?: boolean }
  ) => Promise<void>;
  deleteSpace: (id: string) => Promise<void>;
  createBooking: (input: BookingInput) => Promise<Booking>;
  setBookingStatus: (id: string, status: BookingStatus, reason?: CancelReason | null) => Promise<void>;
  /** 손님 '입금했어요' — 만료 보류 + 입금자명 저장 */
  claimDeposit: (id: string, depositorName: string, token?: string | null) => Promise<void>;
  saveAccount: (spaceId: string, account: BankAccount) => Promise<void>;
  /** 확정 후 공개되는 상세주소·출입 안내 (사장님·관리자만 조회) */
  loadSpacePrivate: (spaceId: string) => Promise<SpacePrivate | null>;
  savePrivate: (spaceId: string, info: SpacePrivate) => Promise<void>;
  updateRefund: (id: string, refundStatus: RefundStatus, memo?: string) => Promise<void>;
  approveSpace: (spaceId: string, status: ApprovalStatus, reason?: string) => Promise<void>;
  createBlock: (input: BlockInput) => Promise<void>;
  /** 외부 예약·캘린더에서 가져온 여러 건을 한 번에 차단 등록 (건별 결과 반환) */
  createBlocks: (spaceId: string, items: BulkBlockItem[]) => Promise<BulkBlockResult[]>;
  releaseBlock: (bookingId: string) => Promise<void>;
  findSpace: (idOrSlug: string) => Space | undefined;
  reset: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<Profile | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingEvents, setBookingEvents] = useState<BookingEvent[]>([]);
  const [spaceAccounts, setSpaceAccounts] = useState<Record<string, BankAccount>>({});

  const bootstrap = useCallback(async () => {
    try {
      const profile = await getSessionProfile();
      const spaceList = await fetchSpaces();
      setSpaces(spaceList);
      setUser(profile);
      setBookings(profile ? await fetchBookings(profile) : []);
      setBookingEvents(profile ? await fetchBookingEvents() : []);
      setSpaceAccounts(profile ? await fetchSpaceAccounts() : {});
    } catch (error) {
      console.error(error);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const visibleSpaces = useMemo(
    () =>
      spaces.filter(
        (space) =>
          (space.approvalStatus === "approved" || space.hostId === user?.id) &&
          (!space.hidden || space.hostId === user?.id)
      ),
    [spaces, user?.id]
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const profile = await signInWithEmail(email, password);
    setUser(profile);
    setBookings(await fetchBookings(profile));
    setBookingEvents(await fetchBookingEvents());
    setSpaceAccounts(await fetchSpaceAccounts());
    return profile;
  }, []);

  const signUp = useCallback(
    async (input: { email: string; password: string; name: string; role: Role; phone?: string }) => {
      const profile = await signUpWithEmail(input);
      setUser(profile);
      setBookings(await fetchBookings(profile));
      setBookingEvents(await fetchBookingEvents());
      setSpaceAccounts(await fetchSpaceAccounts());
      return profile;
    },
    []
  );

  const demoSignIn = useCallback(
    async (role: Role) => {
      const account = DEMO_ACCOUNTS[role];
      try {
        return await signIn(account.email, account.password);
      } catch {
        return await signUp({
          email: account.email,
          password: account.password,
          name: account.name,
          role: account.role,
        });
      }
    },
    [signIn, signUp]
  );

  const signOut = useCallback(async () => {
    await signOutUser();
    setUser(null);
    setBookings([]);
    setBookingEvents([]);
    setSpaceAccounts({});
  }, []);

  const refresh = useCallback(async () => {
    const spaceList = await fetchSpaces();
    setSpaces(spaceList);
    setSpaceAccounts(await fetchSpaceAccounts());
    if (user) {
      setBookings(await fetchBookings(user));
      setBookingEvents(await fetchBookingEvents());
    }
  }, [user]);

  const createSpace = useCallback(
    async (input: SpaceInput) => {
      if (!user) throw new Error("로그인 후 이용해 주세요.");
      const space = await insertSpace(input, user);
      setSpaces((prev) => [space, ...prev]);
      setSpaceAccounts(await fetchSpaceAccounts());
      revalidateHomeCache();
      return space;
    },
    [user]
  );

  const updateSpace = useCallback(
    async (id: string, patch: Partial<SpaceInput> & { featured?: boolean; timeDeal?: boolean }) => {
      const updated = await patchSpace(id, patch);
      if (updated) {
        setSpaces((prev) => prev.map((space) => (space.id === id ? updated : space)));
      }
      setSpaceAccounts(await fetchSpaceAccounts());
      revalidateHomeCache();
    },
    []
  );

  const saveAccount = useCallback(async (spaceId: string, account: BankAccount) => {
    await saveSpaceAccount(spaceId, account);
    setSpaceAccounts(await fetchSpaceAccounts());
  }, []);

  const deleteSpace = useCallback(async (id: string) => {
    await removeSpace(id);
    setSpaces((prev) => prev.filter((space) => space.id !== id));
    setBookings((prev) => prev.filter((booking) => booking.spaceId !== id));
    revalidateHomeCache();
  }, []);

  const createBooking = useCallback(
    async (input: BookingInput) => {
      const booking = await insertBooking(input, user);
      setBookings((prev) => [booking, ...prev]);
      fetchBookingEvents().then(setBookingEvents).catch(() => {});
      return booking;
    },
    [user]
  );

  const setBookingStatus = useCallback(
    async (id: string, status: BookingStatus, reason: CancelReason | null = null) => {
      const updated = await updateBookingStatus(id, status, reason);
      if (updated) {
        setBookings((prev) => prev.map((booking) => (booking.id === id ? updated : booking)));
      }
    },
    []
  );

  const claimDepositAction = useCallback(
    async (id: string, depositorName: string, token?: string | null) => {
      const updated = await claimDeposit(id, depositorName, token);
      if (updated) {
        setBookings((prev) => prev.map((booking) => (booking.id === id ? updated : booking)));
      }
    },
    []
  );

  const accountFor = useCallback((spaceId: string) => spaceAccounts[spaceId] ?? null, [spaceAccounts]);

  const loadSpacePrivate = useCallback(async (spaceId: string) => {
    if (!spaceId) return null;
    return fetchSpacePrivate(spaceId);
  }, []);

  const savePrivate = useCallback(async (spaceId: string, info: SpacePrivate) => {
    await saveSpacePrivate(spaceId, info);
  }, []);

  const updateRefund = useCallback(async (id: string, refundStatus: RefundStatus, memo = "") => {
    const updated = await updateRefundStatus(id, refundStatus, memo);
    if (updated) {
      setBookings((prev) => prev.map((booking) => (booking.id === id ? updated : booking)));
      fetchBookingEvents().then(setBookingEvents).catch(() => {});
    }
  }, []);

  const approveSpace = useCallback(async (spaceId: string, status: ApprovalStatus, reason = "") => {
    const updated = await setSpaceApproval(spaceId, status, reason);
    if (updated) {
      setSpaces((prev) => prev.map((space) => (space.id === spaceId ? updated : space)));
      revalidateHomeCache();
    }
  }, []);

  const createBlock = useCallback(
    async (input: BlockInput) => {
      const booking = await createSpaceBlock(input);
      setBookings((prev) => [booking, ...prev]);
      fetchBookingEvents().then(setBookingEvents).catch(() => {});
    },
    []
  );

  const createBlocks = useCallback(async (spaceId: string, items: BulkBlockItem[]) => {
    const results = await createSpaceBlocksBulk(spaceId, items);
    const created = await fetchBookings(user as Profile);
    setBookings(created);
    fetchBookingEvents().then(setBookingEvents).catch(() => {});
    return results;
  }, [user]);

  const releaseBlock = useCallback(async (bookingId: string) => {
    const updated = await releaseSpaceBlock(bookingId);
    if (updated) {
      setBookings((prev) => prev.map((booking) => (booking.id === bookingId ? updated : booking)));
      fetchBookingEvents().then(setBookingEvents).catch(() => {});
    }
  }, []);

  const findSpace = useCallback(
    (idOrSlug: string) => spaces.find((space) => space.id === idOrSlug || space.paySlug === idOrSlug),
    [spaces]
  );

  const reset = useCallback(() => {
    resetDemoData();
    setUser(null);
    setBookings([]);
    setSpaces([]);
    setReady(false);
    void bootstrap();
  }, [bootstrap]);

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      mode: dataMode,
      user,
      spaces,
      visibleSpaces,
      bookings,
      bookingEvents,
      spaceAccounts,
      accountFor,
      signIn,
      signUp,
      demoSignIn,
      signOut,
      refresh,
      createSpace,
      updateSpace,
      deleteSpace,
      createBooking,
      setBookingStatus,
      claimDeposit: claimDepositAction,
      saveAccount,
      loadSpacePrivate,
      savePrivate,
      updateRefund,
      approveSpace,
      createBlock,
      createBlocks,
      releaseBlock,
      findSpace,
      reset,
    }),
    [
      ready,
      user,
      spaces,
      visibleSpaces,
      bookings,
      bookingEvents,
      spaceAccounts,
      accountFor,
      signIn,
      signUp,
      demoSignIn,
      signOut,
      refresh,
      createSpace,
      updateSpace,
      deleteSpace,
      createBooking,
      setBookingStatus,
      claimDepositAction,
      saveAccount,
      loadSpacePrivate,
      savePrivate,
      updateRefund,
      approveSpace,
      createBlock,
      createBlocks,
      releaseBlock,
      findSpace,
      reset,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
