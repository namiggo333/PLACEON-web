"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "./AppProvider";
import { ROLE_LABEL } from "@/lib/constants";
import { cn } from "@/lib/format";
import {
  CalendarIcon,
  HomeIcon,
  LogoutIcon,
  SearchIcon,
  ShieldIcon,
  SparkleIcon,
  StoreIcon,
} from "./Icons";
import { isAdminEmail } from "@/lib/admin";

const NAV = [
  { href: "/", label: "홈", icon: HomeIcon },
  { href: "/search", label: "공간 찾기", icon: SearchIcon },
  { href: "/bookings", label: "예약 내역", icon: CalendarIcon },
  { href: "/host", label: "사장님 센터", icon: StoreIcon },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut, ready } = useApp();

  return (
    <header className="sticky top-0 z-40 border-b border-ink-line/80 bg-white/90 backdrop-blur">
      <div className="container-page flex h-14 items-center justify-between gap-4 sm:h-16">
        <div className="flex items-center gap-7">
          <Link href="/" className="flex items-center gap-2" aria-label="플레이스온 홈">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white shadow-sm">
              <SparkleIcon size={19} />
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-[17px] font-extrabold tracking-tight text-ink">플레이스온</span>
              <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-brand">PlaceOn</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-semibold transition",
                    active ? "bg-brand-light text-brand" : "text-ink-soft hover:bg-ink-line/60 hover:text-ink"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {ready && user && isAdminEmail(user.email) && (
            <Link
              href="/admin"
              className={cn(
                "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition",
                pathname.startsWith("/admin")
                  ? "bg-brand text-white"
                  : "bg-brand-light text-brand hover:bg-brand-soft"
              )}
            >
              <ShieldIcon size={14} />
              <span>관리자</span>
            </Link>
          )}
          {ready && user ? (
            <>
              <div className="hidden items-center gap-2 sm:flex">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-light text-xs font-bold text-brand">
                  {user.name.slice(0, 1)}
                </span>
                <span className="text-sm font-semibold text-ink">{user.name}</span>
                <span className="rounded-md bg-ink-line/70 px-1.5 py-0.5 text-[10px] font-bold text-ink-soft">
                  {ROLE_LABEL[user.role]}
                </span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  router.push("/");
                }}
                className="grid h-9 w-9 place-items-center rounded-lg text-ink-mute transition hover:bg-ink-line/60 hover:text-ink"
                aria-label="로그아웃"
              >
                <LogoutIcon size={18} />
              </button>
            </>
          ) : (
            <Link href="/auth" className="btn-primary btn-sm px-4 py-2">
              로그인
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="grid grid-cols-4">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition",
                active ? "text-brand" : "text-ink-mute"
              )}
            >
              <Icon size={22} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-ink-line bg-ink-line/20">
      <div className="container-page flex flex-col gap-6 py-10 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">
              <SparkleIcon size={17} />
            </span>
            <span className="text-base font-extrabold text-ink">플레이스온</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand">PlaceOn</span>
          </div>
          <p className="mt-3 max-w-sm text-xs leading-relaxed text-ink-mute">
            시간 단위로 빌리는 모든 공간. 예약부터 결제·광고까지 한 곳에서. 사장님의 자체 손님은 전용 예약 링크로
            바로 모실 수 있어요.
          </p>
        </div>
        <div className="flex gap-10 text-xs text-ink-soft">
          <div className="flex flex-col gap-2">
            <span className="font-bold text-ink">이용하기</span>
            <Link href="/search" className="hover:text-brand">공간 찾기</Link>
            <Link href="/bookings" className="hover:text-brand">예약 내역</Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-bold text-ink">사장님</span>
            <Link href="/host" className="hover:text-brand">사장님 센터</Link>
            <Link href="/host" className="hover:text-brand">공간 등록</Link>
            <Link href="/host" className="hover:text-brand">결제 링크 만들기</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-ink-line/70">
        <div className="container-page flex flex-col gap-1 py-4 text-[11px] text-ink-mute sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 PlaceOn. 공간대여 예약·결제·광고 통합 플랫폼.</span>
        </div>
      </div>
    </footer>
  );
}

export function Chrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = pathname.startsWith("/pay");

  if (bare) return <>{children}</>;

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1 pb-20 md:pb-0">{children}</main>
      <div className="md:pb-0">
        <SiteFooter />
      </div>
      <BottomNav />
    </div>
  );
}
