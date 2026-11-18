"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  fetchBookings,
  fetchSpaces,
  fetchSpaceAccounts,
  getSessionProfile,
  insertBooking,
  insertSpace,
  patchSpace,
  removeSpace,
  saveSpaceAccount,
  signInWithEmail,
  signOutUser,
  signUpWithEmail,
  updateBookingStatus,
  resetDemoData,
} from "@/lib/db";
import { dataMode } from "@/lib/supabase";
import { revalidateHomeCache } from "@/lib/revalidate";
import { DEMO_ACCOUNTS } from "@/lib/constants";
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
} from "@/lib/types";

interface AppContextValue {
  ready: boolean;
  mode: "demo" | "supabase";
  user: Profile | null;
  spaces: Space[];
  /** 손님에게 보여지는 공간 목록 (비공개 처리한 공간은 사장님 본인에게만 남는다) */
  visibleSpaces: Space[];
  bookings: Booking[];
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
  saveAccount: (spaceId: string, account: BankAccount) => Promise<void>;
  findSpace: (idOrSlug: string) => Space | undefined;
  reset: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<Profile | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [spaceAccounts, setSpaceAccounts] = useState<Record<string, BankAccount>>({});

  const bootstrap = useCallback(async () => {
    try {
      const profile = await getSessionProfile();
      const spaceList = await fetchSpaces();
      setSpaces(spaceList);
      setUser(profile);
      setBookings(profile ? await fetchBookings(profile) : []);
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
    () => spaces.filter((space) => !space.hidden || space.hostId === user?.id),
    [spaces, user?.id]
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const profile = await signInWithEmail(email, password);
    setUser(profile);
    setBookings(await fetchBookings(profile));
    setSpaceAccounts(await fetchSpaceAccounts());
    return profile;
  }, []);

  const signUp = useCallback(
    async (input: { email: string; password: string; name: string; role: Role; phone?: string }) => {
      const profile = await signUpWithEmail(input);
      setUser(profile);
      setBookings(await fetchBookings(profile));
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
    setSpaceAccounts({});
  }, []);

  const refresh = useCallback(async () => {
    const spaceList = await fetchSpaces();
    setSpaces(spaceList);
    setSpaceAccounts(await fetchSpaceAccounts());
    if (user) setBookings(await fetchBookings(user));
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

  const accountFor = useCallback((spaceId: string) => spaceAccounts[spaceId] ?? null, [spaceAccounts]);

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
      saveAccount,
      findSpace,
      reset,
    }),
    [
      ready,
      user,
      spaces,
      visibleSpaces,
      bookings,
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
      saveAccount,
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
