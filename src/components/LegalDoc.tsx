import Link from "next/link";
import type { ReactNode } from "react";

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

const LEGAL_NAV = [
  { href: "/terms", label: "이용약관" },
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/refund", label: "취소·환불 규정" },
];

export function LegalDoc({
  title,
  lead,
  effectiveDate,
  sections,
  notice,
}: {
  title: string;
  lead: string;
  effectiveDate: string;
  sections: LegalSection[];
  notice?: ReactNode;
}) {
  return (
    <div className="container-page py-8 sm:py-12">
      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-mute">이곳저곳 정책</p>
          <nav className="mt-3 flex flex-wrap gap-1.5 lg:flex-col">
            {LEGAL_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  item.label === title
                    ? "rounded-lg bg-brand-light px-3 py-2 text-[13px] font-bold text-brand"
                    : "rounded-lg px-3 py-2 text-[13px] font-semibold text-ink-soft transition hover:bg-ink-line/50 hover:text-ink"
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-5 hidden rounded-xl2 border border-ink-line bg-white/70 p-3.5 lg:block">
            <p className="text-[11px] font-bold text-ink">목차</p>
            <ol className="mt-2 space-y-1.5">
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-[11.5px] leading-snug text-ink-mute transition hover:text-brand"
                  >
                    {index + 1}. {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </aside>

        <article className="min-w-0">
          <header className="border-b border-ink-line pb-5">
            <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">{title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{lead}</p>
            <p className="mt-3 text-[11px] font-medium text-ink-mute">시행일 {effectiveDate}</p>
          </header>

          {notice && (
            <div className="mt-5 rounded-xl2 border border-brand/20 bg-brand-light/70 p-4 text-[12px] leading-relaxed text-ink-soft">
              {notice}
            </div>
          )}

          <div className="mt-6 space-y-7">
            {sections.map((section, index) => (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                <h2 className="text-[15px] font-extrabold text-ink">
                  <span className="mr-1.5 text-brand">제{index + 1}조</span>
                  {section.title}
                </h2>
                <div className="mt-2 space-y-2 text-[13px] leading-[1.75] text-ink-soft">{section.body}</div>
              </section>
            ))}
          </div>

          <footer className="mt-10 rounded-xl2 border border-ink-line bg-white/80 p-4 text-[12px] leading-relaxed text-ink-mute">
            <p className="font-bold text-ink">이곳저곳 (공간대여 예약·결제 플랫폼)</p>
            <p className="mt-1">
              상호: 이곳저곳 · 대표자: 박기남 · 사업자등록번호: 사업자 등록 후 기재
              <br />
              통신판매업 신고: 신고 후 기재 · 주소: 사업장 주소 등록 후 기재
              <br />
              문의: namiggo333@gmail.com
            </p>
            <p className="mt-2">
              본 문서는 표준 서비스 운영을 기준으로 작성되었으며, 사업자등록·통신판매업 신고 완료 후 해당 정보가
              갱신됩니다. 결제·환불에 관한 자세한 기준은{" "}
              <Link href="/refund" className="font-semibold text-brand hover:underline">
                취소·환불 규정
              </Link>
              을 참고해 주세요.
            </p>
          </footer>
        </article>
      </div>
    </div>
  );
}
