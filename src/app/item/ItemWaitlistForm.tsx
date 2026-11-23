"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { CheckIcon, SparkleIcon } from "@/components/Icons";
import { ITEM_CATEGORIES, ITEM_SPACE_TYPES } from "@/lib/constants";
import { cn } from "@/lib/format";

type ContactType = "phone" | "email";

interface FormState {
  categories: string[];
  customItem: string;
  spaceType: string;
  budgetOrQty: string;
  contactType: ContactType;
  contact: string;
  note: string;
  wantsNotice: boolean;
  website: string;
}

const EMPTY: FormState = {
  categories: [],
  customItem: "",
  spaceType: "",
  budgetOrQty: "",
  contactType: "phone",
  contact: "",
  note: "",
  wantsNotice: true,
  website: "",
};

function formatPhone(value: string): string {
  const digits = value.replace(/[^\d]/g, "").slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function ItemWaitlistForm({ defaultSource = "item" }: { defaultSource?: "item" | "host" }) {
  const { user, ready } = useApp();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ duplicate: boolean } | null>(null);

  // 로그인한 사장님이면 연락처를 미리 채워 준다(수정 가능).
  useEffect(() => {
    if (!ready || !user) return;
    setForm((prev) => {
      if (prev.contact) return prev;
      if (user.phone) return { ...prev, contactType: "phone", contact: formatPhone(user.phone) };
      if (user.email) return { ...prev, contactType: "email", contact: user.email };
      return prev;
    });
  }, [ready, user]);

  const selectedLabels = useMemo(
    () => ITEM_CATEGORIES.filter((item) => form.categories.includes(item.key)).map((item) => item.label),
    [form.categories]
  );

  function toggleCategory(key: string) {
    setTouched(true);
    setForm((prev) => ({
      ...prev,
      categories: prev.categories.includes(key)
        ? prev.categories.filter((item) => item !== key)
        : [...prev.categories, key],
    }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    setError("");

    if (form.categories.length === 0 && !form.customItem.trim()) {
      setError("필요한 비품·가전 카테고리를 하나 이상 골라 주세요.");
      return;
    }
    if (!form.spaceType) {
      setError("운영 중이거나 준비 중인 공간 유형을 골라 주세요.");
      return;
    }
    if (!form.contact.trim()) {
      setError(form.contactType === "phone" ? "휴대폰 번호를 입력해 주세요." : "이메일을 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/item/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categories: form.categories,
          customItem: form.customItem,
          spaceType: form.spaceType,
          budgetOrQty: form.budgetOrQty,
          contactType: form.contactType,
          contact: form.contact,
          note: form.note,
          wantsNotice: form.wantsNotice,
          source: defaultSource,
          website: form.website,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; duplicate?: boolean; error?: string }
        | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? "신청을 접수하지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
      setDone({ duplicate: Boolean(payload.duplicate) });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "신청을 접수하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="card overflow-hidden">
        <div className="bg-[linear-gradient(135deg,#FFF0F6_0%,#FFE4EF_100%)] px-5 py-8 text-center sm:px-8 sm:py-10">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-dark text-white shadow-pop">
            <CheckIcon size={26} />
          </span>
          <h3 className="mt-4 text-xl font-extrabold text-ink sm:text-2xl">
            {done.duplicate ? "이미 접수된 신청이에요" : "사전 수요조사가 접수됐어요"}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            {done.duplicate ? (
              <>방금 전 같은 연락처로 접수된 신청이 있어요. 중복으로 저장하지 않았습니다.</>
            ) : (
              <>
                이곳저곳에서 직접 확인하고, 가장 많이 신청된 품목부터 검수·입고를 준비할게요.
                <br className="hidden sm:block" /> 오픈 소식은 남겨 주신 연락처로 가장 먼저 알려 드립니다.
              </>
            )}
          </p>
          {selectedLabels.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {selectedLabels.map((label) => (
                <span key={label} className="rounded-full bg-white px-3 py-1 text-[13px] font-bold text-brand-dark shadow-sm">
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 px-5 py-5 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => {
              setDone(null);
              setTouched(false);
              setForm((prev) => ({ ...EMPTY, contactType: prev.contactType, contact: prev.contact }));
            }}
            className="btn-ghost w-full sm:w-auto"
          >
            다른 품목도 신청하기
          </button>
          <Link href="/" className="btn-primary w-full sm:w-auto">
            공간 둘러보기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card p-5 sm:p-7" noValidate>
      {/* 1. 필요한 카테고리 */}
      <fieldset>
        <legend className="flex items-center gap-2 text-[15px] font-bold text-ink">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-dark text-[12px] font-extrabold text-white">
            1
          </span>
          필요한 비품·가전을 골라 주세요
          <span className="text-brand">*</span>
        </legend>
        <p className="mt-1 pl-8 text-[13px] text-ink-mute">여러 개 골라도 괜찮아요.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ITEM_CATEGORIES.map((item) => {
            const active = form.categories.includes(item.key);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => toggleCategory(item.key)}
                aria-pressed={active}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition",
                  active
                    ? "border-brand-dark bg-brand-light text-brand-dark shadow-sm"
                    : "border-ink-line bg-white text-ink-soft hover:border-brand/40 hover:text-ink"
                )}
              >
                <span aria-hidden className="text-lg leading-none">
                  {item.emoji}
                </span>
                <span className="min-w-0 text-[13px] font-semibold leading-tight">{item.label}</span>
                {active && <CheckIcon size={14} className="ml-auto shrink-0 text-brand-dark" />}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* 2. 구체 품목 */}
      <div className="mt-6">
        <label htmlFor="item-custom" className="flex items-center gap-2 text-[15px] font-bold text-ink">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-light text-[12px] font-extrabold text-brand-dark">
            2
          </span>
          구체적으로 필요한 품목·모델
          <span className="rounded-md bg-ink-line/70 px-1.5 py-0.5 text-[12px] font-bold text-ink-mute">선택</span>
        </label>
        <input
          id="item-custom"
          value={form.customItem}
          onChange={(event) => setForm((prev) => ({ ...prev, customItem: event.target.value }))}
          placeholder="예: 4인용 테이블 2개, 무선 마이크 2채널, 스탠드 에어컨 1대"
          maxLength={300}
          className="input mt-2"
        />
      </div>

      {/* 3. 공간 유형 */}
      <fieldset className="mt-6">
        <legend className="flex items-center gap-2 text-[15px] font-bold text-ink">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-light text-[12px] font-extrabold text-brand-dark">
            3
          </span>
          운영 중이거나 준비 중인 공간
          <span className="text-brand">*</span>
        </legend>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {ITEM_SPACE_TYPES.map((item) => {
            const active = form.spaceType === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setTouched(true);
                  setForm((prev) => ({ ...prev, spaceType: item.key }));
                }}
                aria-pressed={active}
                className={cn("chip", active && "chip-active")}
              >
                <span aria-hidden>{item.emoji}</span>
                {item.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* 4. 예산·수량 */}
      <div className="mt-6">
        <label htmlFor="item-budget" className="flex items-center gap-2 text-[15px] font-bold text-ink">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-light text-[12px] font-extrabold text-brand-dark">
            4
          </span>
          희망 예산대 · 수량
          <span className="rounded-md bg-ink-line/70 px-1.5 py-0.5 text-[12px] font-bold text-ink-mute">선택</span>
        </label>
        <input
          id="item-budget"
          value={form.budgetOrQty}
          onChange={(event) => setForm((prev) => ({ ...prev, budgetOrQty: event.target.value }))}
          placeholder="예: 50만원 이하 / 2개"
          maxLength={100}
          className="input mt-2"
        />
      </div>

      {/* 5. 연락처 */}
      <fieldset className="mt-6">
        <legend className="flex items-center gap-2 text-[15px] font-bold text-ink">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-light text-[12px] font-extrabold text-brand-dark">
            5
          </span>
          오픈 알림 받을 연락처
          <span className="text-brand">*</span>
        </legend>
        <div className="mt-2 flex gap-1.5">
          {(["phone", "email"] as ContactType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  contactType: type,
                  contact: type === "phone" ? formatPhone(prev.contactType === "email" ? "" : prev.contact) : prev.contactType === "phone" ? "" : prev.contact,
                }))
              }
              aria-pressed={form.contactType === type}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[13px] font-bold transition",
                form.contactType === type ? "bg-ink text-white" : "bg-ink-line/60 text-ink-soft hover:text-ink"
              )}
            >
              {type === "phone" ? "휴대폰" : "이메일"}
            </button>
          ))}
        </div>
        <input
          value={form.contact}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              contact: prev.contactType === "phone" ? formatPhone(event.target.value) : event.target.value,
            }))
          }
          type={form.contactType === "phone" ? "tel" : "email"}
          inputMode={form.contactType === "phone" ? "numeric" : "email"}
          autoComplete={form.contactType === "phone" ? "tel" : "email"}
          placeholder={form.contactType === "phone" ? "010-0000-0000" : "name@example.com"}
          maxLength={120}
          className="input mt-2"
          aria-label="연락처"
        />
        <p className="mt-1.5 text-[12px] leading-relaxed text-ink-mute">
          수요 집계와 오픈 알림에만 사용하고, 광고나 다른 목적으로 쓰지 않아요.
        </p>
      </fieldset>

      {/* 6. 요청사항 */}
      <div className="mt-6">
        <label htmlFor="item-note" className="flex items-center gap-2 text-[15px] font-bold text-ink">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-light text-[12px] font-extrabold text-brand-dark">
            6
          </span>
          자유 요청사항
          <span className="rounded-md bg-ink-line/70 px-1.5 py-0.5 text-[12px] font-bold text-ink-mute">선택</span>
        </label>
        <textarea
          id="item-note"
          value={form.note}
          onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
          rows={3}
          maxLength={1000}
          placeholder="예: 설치·배송 가능 여부, A/S 조건, 원하는 색상 등"
          className="input mt-2 resize-y"
        />
      </div>

      {/* 봇 방지용 허니팟 — 사람에게는 보이지 않는다 */}
      <div className="hidden" aria-hidden>
        <label htmlFor="item-website">website</label>
        <input
          id="item-website"
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={(event) => setForm((prev) => ({ ...prev, website: event.target.value }))}
        />
      </div>

      <label className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-xl bg-brand-light/70 px-3.5 py-3">
        <input
          type="checkbox"
          checked={form.wantsNotice}
          onChange={(event) => setForm((prev) => ({ ...prev, wantsNotice: event.target.checked }))}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#E01867]"
        />
        <span className="text-[13px] font-semibold leading-relaxed text-ink-soft">
          <b className="text-brand-dark">오픈 알림</b>을 받을게요. 오픈 며칠 전, 가장 먼저 특가 소식을 보내 주세요.
        </span>
      </label>

      {error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] font-semibold text-red-600">
          {error}
        </p>
      )}

      <button type="submit" disabled={submitting} className="btn-primary mt-4 w-full py-3.5 text-[15px]">
        {submitting ? "접수 중…" : (
          <>
            <SparkleIcon size={16} /> 수요조사 신청하고 오픈 알림 받기
          </>
        )}
      </button>
      <p className="mt-2.5 text-center text-[12px] leading-relaxed text-ink-mute">
        신청은 무료이고, 어떤 상품도 아직 판매하지 않아요. 결제·구매가 발생하지 않습니다.
      </p>
      {touched && (
        <p className="mt-1 text-center text-[12px] text-ink-faint">
          연락처는 <Link href="/privacy" className="underline">개인정보처리방침</Link>에 따라 보관·파기됩니다.
        </p>
      )}
    </form>
  );
}
