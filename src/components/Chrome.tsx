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
  StoreIcon,
} from "./Icons";
import { LogoMark, Slogan, Wordmark } from "./Logo";
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

/**
 * 이곳저곳 Item 진입 메뉴(상단·모바일·푸터)는 사장님에게만 노출한다.
 * - 사장님 역할(host) 또는 총괄 관리자(admin)로 로그인한 경우에만 보이고,
 *   비로그인·일반 게스트에게는 상단·푸터 어디에도 보이지 않는다.
 * - 사장님 센터(/host)의 Item 배너와 /item 주소 직접 접속은 그대로 열어 둔다.
 */
function useShowItemMenu() {
  const { user, ready } = useApp();
  return ready && !!user && (user.role === "host" || isAdminEmail(user.email));
}

function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut, ready } = useApp();
  const showItem = useShowItemMenu();

  return (
    <header className="sticky top-0 z-40 border-b border-ink-line/70 bg-white/92 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between gap-3 sm:h-[74px]">
        <div className="flex min-w-0 items-center gap-3 lg:gap-5">
          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="이곳저곳 홈">
            <LogoMark size={32} className="sm:hidden" decorative />
            <LogoMark size={38} className="hidden sm:block" decorative />
            <Wordmark className="sm:hidden" size="md" />
            <Wordmark className="hidden sm:inline-flex" size="lg" />
          </Link>

          <span className="hidden h-9 w-px bg-ink-line lg:block" aria-hidden />
          <Slogan className="hidden lg:flex" />

          <nav className="ml-1 hidden items-center gap-0.5 md:flex lg:ml-3">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-full px-3 py-2 text-[13.5px] font-semibold transition",
                    active ? "bg-brand-light text-brand-dark" : "text-ink-soft hover:bg-ink-line/60 hover:text-ink"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            {showItem && (
              <Link
                href="/item"
                className={cn(
                  "ml-0.5 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13.5px] font-semibold transition",
                  isActive(pathname, "/item")
                    ? "bg-brand-light text-brand-dark"
                    : "text-ink-soft hover:bg-ink-line/60 hover:text-ink"
                )}
              >
                이곳저곳 Item
                <span className="rounded-full bg-brand-light px-1.5 py-0.5 text-[12px] font-extrabold leading-none text-brand-dark">
                  오픈예정
                </span>
              </Link>
            )}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {ready && user && isAdminEmail(user.email) && (
            <Link
              href="/admin"
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-bold transition",
                pathname.startsWith("/admin")
                  ? "bg-brand text-white"
                  : "bg-brand-light text-brand-dark hover:bg-brand-soft"
              )}
            >
              <ShieldIcon size={14} />
              <span>관리자</span>
            </Link>
          )}
          {showItem && (
            <Link
              href="/item"
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[12px] font-extrabold transition md:hidden",
                pathname.startsWith("/item") ? "bg-brand-dark text-white" : "bg-brand-light text-brand-dark hover:bg-brand-soft"
              )}
              aria-label="이곳저곳 Item 오픈 예정"
            >
              Item
              <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
            </Link>
          )}
          {ready && user ? (
            <>
              <div className="hidden items-center gap-2 sm:flex">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-light text-xs font-bold text-brand-dark">
                  {user.name.slice(0, 1)}
                </span>
                <span className="text-sm font-semibold text-ink">{user.name}</span>
                <span className="rounded-md bg-ink-line/70 px-1.5 py-0.5 text-[12px] font-bold text-ink-soft">
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
            <Link href="/auth" className="btn-primary btn-sm rounded-full px-4 py-2">
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
                "flex flex-col items-center gap-1 py-2.5 text-[12px] font-semibold transition",
                active ? "text-brand-dark" : "text-ink-mute"
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
  const showItem = useShowItemMenu();
  return (
    <footer className="mt-16 border-t border-ink-line bg-brand-light/60">
      <div className="container-page flex flex-col gap-6 py-10 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-start gap-2.5">
            <LogoMark size={34} shadow={false} decorative />
            <div className="flex flex-col gap-2.5 pt-1.5">
              <Wordmark size="md" />
              <Slogan className="text-[13px]" />
            </div>
          </div>
          <p className="mt-3.5 max-w-sm text-xs leading-relaxed text-ink-mute">
            시간 단위로 빌리는 모든 공간. 예약부터 결제·광고까지 한 곳에서. 사장님의 자체 손님은 전용 예약 링크로
            바로 모실 수 있어요.
          </p>
        </div>
        <div className="flex gap-10 text-xs text-ink-soft">
          <div className="flex flex-col gap-2">
            <span className="font-bold text-ink">이용하기</span>
            <Link href="/search" className="hover:text-brand-dark">공간 찾기</Link>
            <Link href="/areas" className="hover:text-brand-dark">지역별 찾기</Link>
            <Link href="/bookings" className="hover:text-brand-dark">예약 내역</Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-bold text-ink">사장님</span>
            <Link href="/host" className="hover:text-brand-dark">사장님 센터</Link>
            {showItem && (
              <Link href="/item" className="inline-flex items-center gap-1 hover:text-brand-dark">
                이곳저곳 Item
                <span className="rounded bg-brand-light px-1 py-0.5 text-[12px] font-bold text-brand-dark">오픈예정</span>
              </Link>
            )}
            <Link href="/host" className="hover:text-brand-dark">공간 등록</Link>
            <Link href="/host" className="hover:text-brand-dark">결제 링크 만들기</Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-bold text-ink">약관·정책</span>
            <Link href="/terms" className="hover:text-brand-dark">이용약관</Link>
            <Link href="/privacy" className="font-semibold hover:text-brand-dark">개인정보처리방침</Link>
            <Link href="/refund" className="hover:text-brand-dark">취소·환불 규정</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-ink-line/70">
        <div className="container-page py-4 text-[12px] leading-relaxed text-ink-mute">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link href="/terms" className="font-semibold text-ink-soft hover:text-brand-dark">이용약관</Link>
            <span className="text-ink-line">|</span>
            <Link href="/privacy" className="font-semibold text-ink-soft hover:text-brand-dark">개인정보처리방침</Link>
            <span className="text-ink-line">|</span>
            <Link href="/refund" className="font-semibold text-ink-soft hover:text-brand-dark">취소·환불 규정</Link>
          </div>
          <p className="mt-2">
            상호 이곳저곳 · 대표자 박기남 · 사업자등록번호: 사업자 등록 후 기재 · 통신판매업 신고: 신고 후 기재
            <br className="hidden sm:block" />
            주소: 사업장 주소 등록 후 기재 · 문의 namiggo333@gmail.com
          </p>
          <p className="mt-1.5">© 2026 이곳저곳. 공간대여 예약·결제·광고 통합 플랫폼.</p>
        </div>
      </div>
    </footer>
  );
}

export function Chrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = pathname.startsWith("/pay");
  // 사장님 센터는 자체 하단 탭(오늘·예약·공간·공유)을 쓰므로 게스트 하단 내비를 겹치지 않게 숨긴다.
  const hostCenter = pathname === "/host" || pathname.startsWith("/host/");

  if (bare) return <>{children}</>;

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className={cn("flex-1 md:pb-0", hostCenter ? "pb-0" : "pb-20")}>{children}</main>
      <div className="md:pb-0">
        <SiteFooter />
      </div>
      {!hostCenter && <BottomNav />}
    </div>
  );
}
