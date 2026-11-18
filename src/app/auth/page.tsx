"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { DemoAccountButtons } from "@/components/Bits";
import { CheckIcon } from "@/components/Icons";
import { LogoMark } from "@/components/Logo";
import { ROLE_LABEL } from "@/lib/constants";
import { cn } from "@/lib/format";
import type { Role } from "@/lib/types";

function AuthContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, mode, signIn, signUp, demoSignIn, signOut } = useApp();

  const next = params.get("next");
  const [tab, setTab] = useState<"login" | "signup">(params.get("mode") === "signup" ? "signup" : "login");
  const [role, setRole] = useState<Role>(params.get("role") === "host" ? "host" : "guest");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState<Role | null>(null);

  function destination(targetRole: Role, override?: string | null) {
    if (override) return override;
    return targetRole === "host" ? "/host" : "/";
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (tab === "login") {
        const profile = await signIn(email, password);
        router.replace(destination(profile.role, next));
      } else {
        const profile = await signUp({ email, password, name, role, phone });
        router.replace(destination(profile.role, next));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDemo(targetRole: Role) {
    setError("");
    setDemoBusy(targetRole);
    try {
      await demoSignIn(targetRole);
      router.replace(destination(targetRole, next));
    } catch (err) {
      setError(err instanceof Error ? err.message : "미리보기 계정으로 로그인하지 못했어요.");
    } finally {
      setDemoBusy(null);
    }
  }

  return (
    <div className="container-page py-8 sm:py-14">
      <div className="mx-auto grid max-w-4xl overflow-hidden rounded-xl2 border border-ink-line bg-white shadow-card lg:grid-cols-[1fr_1.05fr]">
        <div className="hidden flex-col justify-between bg-gradient-to-br from-brand via-brand to-brand-dark p-8 text-white lg:flex">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white shadow-sm">
                <LogoMark size={26} decorative />
              </span>
              <span className="text-base font-extrabold">이곳저곳</span>
            </div>
            <h1 className="mt-8 text-2xl font-black leading-snug">
              공간이 필요한 순간,
              <br />
              1초 만에 예약하고
              <br />
              바로 결제하세요.
            </h1>
            <ul className="mt-6 space-y-2.5 text-xs text-white/85">
              {[
                "파티룸부터 스터디룸까지 8개 카테고리",
                "시간당 요금으로 필요한 만큼만",
                "사장님은 자체 손님 결제 링크로 수수료 0%",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <CheckIcon size={14} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-[10px] text-white/60">© 2026 이곳저곳 · 공간대여 예약·결제·광고 통합 플랫폼</p>
        </div>

        <div className="p-6 sm:p-8">
          {user ? (
            <div className="flex h-full flex-col justify-center gap-4 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-light text-xl font-black text-brand">
                {user.name.slice(0, 1)}
              </span>
              <div>
                <p className="text-lg font-extrabold text-ink">{user.name} 님</p>
                <p className="mt-0.5 text-xs text-ink-mute">
                  {user.email} · {ROLE_LABEL[user.role]}
                </p>
              </div>
              <div className="mt-2 flex flex-col gap-2">
                <Link href={user.role === "host" ? "/host" : "/bookings"} className="btn-primary">
                  {user.role === "host" ? "사장님 센터로 가기" : "내 예약 내역 보기"}
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    await signOut();
                  }}
                  className="btn-ghost"
                >
                  로그아웃
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-xl bg-ink-line/40 p-1">
                {(["login", "signup"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setTab(item);
                      setError("");
                    }}
                    className={cn(
                      "flex-1 rounded-lg py-2 text-sm font-bold transition",
                      tab === item ? "bg-white text-ink shadow-sm" : "text-ink-mute hover:text-ink"
                    )}
                  >
                    {item === "login" ? "로그인" : "회원가입"}
                  </button>
                ))}
              </div>

              <h2 className="mt-5 text-xl font-black tracking-tight text-ink">
                {tab === "login" ? "다시 오셨네요!" : "이곳저곳 시작하기"}
              </h2>
              <p className="mt-1 text-xs text-ink-mute">
                {tab === "login"
                  ? "이메일로 로그인하고 예약을 이어가세요."
                  : "게스트와 사장님 모두 같은 계정으로 시작할 수 있어요."}
              </p>

              {tab === "signup" && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {(["guest", "host"] as Role[]).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setRole(item)}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-left transition",
                        role === item
                          ? "border-brand bg-brand-light/70"
                          : "border-ink-line hover:border-brand/40"
                      )}
                    >
                      <span className="block text-xs font-bold text-ink">
                        {item === "guest" ? "🙋 게스트" : "🧑‍💼 사장님"}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-ink-mute">
                        {item === "guest" ? "공간을 예약해요" : "공간을 등록·운영해요"}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <form onSubmit={submit} className="mt-4 space-y-3">
                {tab === "signup" && (
                  <div>
                    <label className="label" htmlFor="name">
                      이름
                    </label>
                    <input
                      id="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="홍길동"
                      className="input"
                      autoComplete="name"
                      required
                    />
                  </div>
                )}
                <div>
                  <label className="label" htmlFor="email">
                    이메일
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="input"
                    autoComplete="email"
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="password">
                    비밀번호
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="6자 이상"
                    className="input"
                    autoComplete={tab === "login" ? "current-password" : "new-password"}
                    required
                  />
                </div>
                {tab === "signup" && (
                  <div>
                    <label className="label" htmlFor="phone">
                      연락처 (선택)
                    </label>
                    <input
                      id="phone"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="010-0000-0000"
                      className="input"
                      inputMode="tel"
                      autoComplete="tel"
                    />
                  </div>
                )}

                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-[11px] font-medium text-red-600">{error}</p>
                )}

                <button type="submit" disabled={busy} className="btn-primary w-full py-3">
                  {busy ? "처리 중…" : tab === "login" ? "로그인" : "회원가입"}
                </button>
              </form>

              {mode === "demo" && (
                <>
                  <div className="my-4 flex items-center gap-3">
                    <span className="h-px flex-1 bg-ink-line" />
                    <span className="text-[10px] font-semibold text-ink-mute">미리보기 계정으로 바로 보기</span>
                    <span className="h-px flex-1 bg-ink-line" />
                  </div>

                  <DemoAccountButtons onPick={handleDemo} busy={demoBusy} />
                </>
              )}

              <p className="mt-3 text-[10px] leading-relaxed text-ink-mute">
                {mode === "demo"
                  ? "미리보기 모드예요. 입력한 계정·공간·예약이 이 브라우저에만 저장돼요."
                  : "가입한 계정과 예약 정보는 이곳저곳 서버에 저장되고, 다른 기기에서도 그대로 이어져요."}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="container-page py-14">
          <div className="mx-auto h-96 max-w-4xl skeleton" />
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  );
}
