import type { Metadata } from "next";
import Link from "next/link";
import { CheckIcon, ChevronRightIcon, SparkleIcon } from "@/components/Icons";
import { ITEM_CATEGORIES } from "@/lib/constants";
import { ItemWaitlistForm } from "./ItemWaitlistForm";

export const metadata: Metadata = {
  title: "이곳저곳 Item · 공간 사장님을 위한 리퍼·비품 특가 몰 (오픈 예정)",
  description:
    "파티룸·촬영스튜디오·연습실 사장님을 위한 리퍼·비품 특가 몰, 이곳저곳 Item이 곧 오픈합니다. 필요한 비품·가전을 미리 신청하면 가장 많이 찾은 품목부터 검수해 준비하고, 오픈 알림을 가장 먼저 보내 드려요.",
  openGraph: {
    title: "이곳저곳 Item · 곧 오픈합니다",
    description: "공간 사장님을 위한 리퍼·비품 특가 몰. 필요한 품목을 미리 알려 주시면 가장 많이 찾은 것부터 준비해요.",
    type: "website",
  },
  alternates: { canonical: "/item" },
};

const VALUES = [
  {
    emoji: "🛠️",
    title: "검수된 전시·리퍼",
    body: "매장 전시품·리퍼 상품을 상태 확인 후 올려요. 사진과 상태 등급을 미리 공개합니다.",
  },
  {
    emoji: "🏷️",
    title: "공간 사장님 전용 특가",
    body: "파티룸·스튜디오·연습실에서 실제로 쓰는 품목만 골라, 사장님 기준으로 맞춘 가격을 준비해요.",
  },
  {
    emoji: "🔔",
    title: "오픈 알림 우선 발송",
    body: "수요조사에 남긴 연락처로 오픈 소식과 첫 특가를 가장 먼저 보내 드립니다.",
  },
];

const STEPS = [
  { step: "01", title: "필요한 품목 신청", body: "지금 비어 있는 장비와 사고 싶은 비품을 편하게 적어 주세요." },
  { step: "02", title: "많이 찾은 품목부터 검수·입고", body: "신청이 많은 카테고리부터 상태를 확인한 상품을 준비해요." },
  { step: "03", title: "오픈 알림 · 사장님 특가", body: "오픈하는 날, 신청한 분께 가장 먼저 구매 링크를 보내 드려요." },
];

const FAQS = [
  {
    q: "지금 상품을 살 수 있나요?",
    a: "아니요. 이곳저곳 Item은 아직 오픈 전이라 어떤 상품도 판매하지 않아요. 이 페이지는 필요한 품목을 미리 듣는 사전 수요조사이고, 결제는 발생하지 않습니다.",
  },
  {
    q: "가격과 재고는 언제 알 수 있나요?",
    a: "아직 정해지지 않아 지금은 표시하지 않아요. 실제 검수 상품과 가격이 확정되면 오픈 페이지에서 한 번에 공개합니다.",
  },
  {
    q: "공간을 아직 준비 중이어도 신청할 수 있나요?",
    a: "괜찮아요. 운영 중인 공간뿐 아니라 오픈을 준비 중인 공간 유형도 골라 주시면, 준비 단계에서 필요한 비품을 우선으로 챙길게요.",
  },
  {
    q: "신청하면 광고나 영업 연락이 오나요?",
    a: "아니요. 남겨 주신 연락처는 수요 확인과 오픈 알림에만 사용하고, 광고나 다른 목적으로 쓰지 않아요.",
  },
];

export default function ItemPage() {
  return (
    <div>
      {/* ---------- 오픈 예고 히어로 ---------- */}
      <section className="relative overflow-hidden bg-[linear-gradient(180deg,#FFF0F6_0%,#FFF6FA_48%,#FFFCFE_82%,#FFFFFF_100%)]">
        <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-brand/15 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -left-24 top-44 h-72 w-72 rounded-full bg-[#FFD9E9]/70 blur-3xl" aria-hidden />
        <div className="container-page relative pb-10 pt-8 sm:pb-14 sm:pt-12">
          <nav className="flex items-center gap-1 text-[12.5px] font-semibold text-ink-mute" aria-label="현재 위치">
            <Link href="/" className="hover:text-brand-dark">홈</Link>
            <ChevronRightIcon size={13} />
            <span className="text-ink-soft">이곳저곳 Item</span>
          </nav>

          <div className="mt-5 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-white/85 px-3 py-1 text-[12px] font-extrabold tracking-wide text-brand-dark shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-dark" />
                </span>
                OPEN SOON · 이곳저곳 Item
              </span>

              <h1 className="mt-4 heading-1 text-ink">
                공간 사장님을 위한
                <br />
                리퍼·비품 특가 몰,{" "}
                <span className="relative inline-block text-brand-dark">
                  이곳저곳 Item
                  <span className="absolute inset-x-0 -bottom-1 h-2 rounded-full bg-brand/20" aria-hidden />
                </span>
                <br className="hidden sm:block" /> 곧 오픈합니다
              </h1>

              <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-soft sm:text-base">
                전시·리퍼 가전과 비품을 검수해서, 공간 사장님께 맞춘 특가로 준비해요.{" "}
                <br className="hidden sm:block" />
                지금 필요한 품목을 알려 주시면 <b className="text-ink">가장 많이 찾은 것부터</b> 채워서 오픈할게요.
              </p>

              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
                <a href="#apply" className="btn-primary px-5 py-3 text-[15px]">
                  <SparkleIcon size={16} /> 사전 수요조사 신청하기
                </a>
                <a href="#lineup" className="btn-ghost px-5 py-3 text-[15px]">
                  오픈 예정 카테고리 보기
                </a>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] font-semibold text-ink-soft">
                {["검수 후 입고", "사장님 전용 특가", "오픈 알림 우선 발송"].map((label) => (
                  <span key={label} className="inline-flex items-center gap-1.5">
                    <CheckIcon size={14} className="text-brand-dark" />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[430px]">
              <div className="absolute -inset-4 rounded-[40px] bg-gradient-to-br from-brand/25 via-blush to-white blur-2xl" aria-hidden />
              <div className="relative overflow-hidden rounded-[32px] bg-[linear-gradient(160deg,#FFE4EF_0%,#FFF0F6_60%,#FFFFFF_100%)] p-3 ring-1 ring-white/80 shadow-float">
                <div className="relative overflow-hidden rounded-[24px] bg-blush/70">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/mascot-wave.webp"
                    alt="이곳저곳 마스코트가 인사하는 모습"
                    className="aspect-square w-full object-contain p-2"
                    loading="eager"
                    decoding="async"
                  />
                  <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11.5px] font-extrabold text-brand-dark shadow-sm backdrop-blur">
                    오픈 준비 중
                  </span>
                </div>
                <div className="mt-2 rounded-[20px] bg-white px-4 py-3 shadow-card">
                  <p className="text-[13px] font-extrabold text-ink">“사장님, 어떤 장비가 필요하세요?”</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-mute">
                    신청해 주신 품목이 이곳저곳 Item의 첫 입고 목록이 됩니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container-page space-y-12 pb-6 pt-8 sm:space-y-16 sm:pt-12">
        {/* ---------- 핵심 가치 ---------- */}
        <section>
          <div className="grid gap-3 sm:grid-cols-3">
            {VALUES.map((value) => (
              <article key={value.title} className="card p-5">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-light text-xl" aria-hidden>
                  {value.emoji}
                </span>
                <h2 className="mt-3.5 text-[16px] font-bold text-ink">{value.title}</h2>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">{value.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ---------- 오픈 예정 카테고리 ---------- */}
        <section id="lineup" className="scroll-mt-24">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <span className="text-[12px] font-extrabold tracking-wide text-brand-dark">LINEUP</span>
              <h2 className="mt-1 section-title text-ink">오픈 예정 카테고리</h2>
              <p className="mt-1.5 text-sm text-ink-soft">공간을 운영하며 가장 자주 찾는 품목부터 준비하고 있어요.</p>
            </div>
            <span className="badge bg-brand-light text-brand-dark">전체 오픈 예정</span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {ITEM_CATEGORIES.map((item) => (
              <article
                key={item.key}
                className="group relative overflow-hidden rounded-xl2 border border-ink-line bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-float"
              >
                <span className={`grid h-12 w-12 place-items-center rounded-2xl text-2xl ${item.pastel}`} aria-hidden>
                  {item.emoji}
                </span>
                <span className="badge absolute right-3 top-3 bg-ink-line/70 text-ink-mute">오픈 예정</span>
                <h3 className="mt-3 text-[14.5px] font-bold leading-snug text-ink">{item.label}</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-mute">{item.desc}</p>
              </article>
            ))}
          </div>

          <p className="mt-3.5 rounded-xl bg-ink-line/40 px-4 py-3 text-[12.5px] leading-relaxed text-ink-soft">
            <b className="text-ink">아직 판매 전이에요.</b> 실제 재고나 가격이 정해지지 않아 금액·수량은 표시하지 않습니다.
            오픈 시 검수된 상품의 상태와 가격을 그대로 공개할게요.
          </p>
        </section>

        {/* ---------- 진행 방식 ---------- */}
        <section>
          <h2 className="section-title text-ink">이렇게 준비해요</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {STEPS.map((step) => (
              <article key={step.step} className="rounded-xl2 bg-[linear-gradient(160deg,#FFF6FA_0%,#FFFFFF_100%)] p-5 ring-1 ring-ink-line">
                <span className="text-[12px] font-extrabold tracking-widest text-brand-dark">{step.step}</span>
                <h3 className="mt-2 text-[15px] font-bold text-ink">{step.title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ---------- 사전 수요조사 폼 ---------- */}
        <section id="apply" className="scroll-mt-24">
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-10">
            <div className="lg:sticky lg:top-24">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-light px-3 py-1 text-[12px] font-extrabold text-brand-dark">
                <SparkleIcon size={12} /> 사전 수요조사
              </span>
              <h2 className="mt-3 section-title text-ink">
                필요한 비품·가전,
                <br />
                지금 알려 주세요
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">
                1분이면 끝나요. 신청이 많은 품목부터 검수·입고를 준비하고, 오픈하는 날 가장 먼저 알려 드립니다.
              </p>
              <ul className="mt-4 space-y-2 text-[13px] text-ink-soft">
                {[
                  "신청은 무료, 결제는 없어요",
                  "가격이 정해지면 오픈 페이지에서 공개",
                  "연락처는 오픈 알림에만 사용",
                ].map((label) => (
                  <li key={label} className="flex items-start gap-2">
                    <CheckIcon size={15} className="mt-0.5 shrink-0 text-brand-dark" />
                    {label}
                  </li>
                ))}
              </ul>
              <div className="mt-5 hidden rounded-xl2 bg-[linear-gradient(150deg,#1B1624_0%,#3A1B30_100%)] p-4 text-white lg:block">
                <p className="text-[13px] font-bold">사장님의 한 줄이 입고 목록이 됩니다</p>
                <p className="mt-1 text-[12px] leading-relaxed text-white/75">
                  “빔프로젝터 2대”, “4인 테이블”, “스탠드 에어컨”처럼 편하게 적어 주세요.
                </p>
              </div>
            </div>

            <ItemWaitlistForm />
          </div>
        </section>

        {/* ---------- 자주 묻는 질문 ---------- */}
        <section>
          <h2 className="section-title text-ink">자주 묻는 질문</h2>
          <div className="mt-4 space-y-2">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group card overflow-hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-[14px] font-bold text-ink marker:hidden">
                  {faq.q}
                  <span className="text-ink-mute transition group-open:rotate-90">
                    <ChevronRightIcon size={16} />
                  </span>
                </summary>
                <p className="border-t border-ink-line/70 px-4 py-3 text-[13px] leading-relaxed text-ink-soft">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ---------- 마무리 CTA ---------- */}
        <section className="overflow-hidden rounded-xl3 bg-[linear-gradient(135deg,#E01867_0%,#B80D54_100%)] px-5 py-8 text-center text-white sm:px-8 sm:py-10">
          <p className="text-[12px] font-extrabold tracking-widest text-white/70">IGOTJEOGOT ITEM</p>
          <h2 className="mt-2 text-xl font-extrabold leading-snug sm:text-2xl">
            사장님의 공간에 딱 맞는 장비,
            <br className="sm:hidden" /> 이곳저곳 Item에서 만나요
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-white/80">
            오픈 알림을 신청해 두시면 첫 특가를 놓치지 않아요.
          </p>
          <a href="#apply" className="btn mt-5 bg-white px-5 py-3 text-[15px] text-brand-deep hover:bg-brand-light">
            수요조사 신청하기
          </a>
        </section>
      </div>
    </div>
  );
}
