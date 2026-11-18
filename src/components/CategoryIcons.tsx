import type { SVGProps } from "react";
import type { Category } from "@/lib/types";

type GlyphProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 24, ...props }: GlyphProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

/** 전체 — 점 4개 그리드 */
function AllGlyph(props: GlyphProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="4" width="6.4" height="6.4" rx="2.2" />
      <rect x="13.6" y="4" width="6.4" height="6.4" rx="2.2" />
      <rect x="4" y="13.6" width="6.4" height="6.4" rx="2.2" />
      <rect x="13.6" y="13.6" width="6.4" height="6.4" rx="2.2" />
    </svg>
  );
}

/** 파티룸 — 파티 포퍼 */
function PartyGlyph(props: GlyphProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.6 20.4 6.8 11a1.4 1.4 0 0 1 1.9-.8l5.1 5.1a1.4 1.4 0 0 1-.8 1.9L3.6 20.4Z" />
      <path d="M13.4 10.6 10.9 8.1" />
      <path d="M15.6 4.6c.4 1.5 1 2.1 2.5 2.5-1.5.4-2.1 1-2.5 2.5-.4-1.5-1-2.1-2.5-2.5 1.5-.4 2.1-1 2.5-2.5Z" />
      <path d="M19.8 8.6c.2.9.6 1.3 1.5 1.5-.9.2-1.3.6-1.5 1.5-.2-.9-.6-1.3-1.5-1.5.9-.2 1.3-.6 1.5-1.5Z" />
      <path d="M18.6 15.6c.2.8.5 1.1 1.3 1.3-.8.2-1.1.5-1.3 1.3-.2-.8-.5-1.1-1.3-1.3.8-.2 1.1-.5 1.3-1.3Z" />
    </svg>
  );
}

/** 키즈룸 — 곰돌이 */
function KidsGlyph(props: GlyphProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="13.4" r="6.4" />
      <circle cx="6.6" cy="7.4" r="2.2" />
      <circle cx="17.4" cy="7.4" r="2.2" />
      <path d="M9.9 12.6h.01M14.1 12.6h.01" />
      <path d="M10.8 16.2c.7.6 1.5.6 2.4 0" />
    </svg>
  );
}

/** 연습실 — 마이크 */
function PracticeGlyph(props: GlyphProps) {
  return (
    <svg {...base(props)}>
      <rect x="9" y="3.2" width="6" height="10.2" rx="3" />
      <path d="M5.6 11.6a6.4 6.4 0 0 0 12.8 0M12 18v2.8M8.6 20.8h6.8" />
    </svg>
  );
}

/** 촬영스튜디오 — 카메라 */
function StudioGlyph(props: GlyphProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.4 8.6A2.2 2.2 0 0 1 5.6 6.4h2.2l1.3-2h5.8l1.3 2h2.2a2.2 2.2 0 0 1 2.2 2.2v8.6a2.2 2.2 0 0 1-2.2 2.2H5.6a2.2 2.2 0 0 1-2.2-2.2V8.6Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

/** 회의실 — 사람들 */
function MeetingGlyph(props: GlyphProps) {
  return (
    <svg {...base(props)}>
      <circle cx="9.2" cy="8.6" r="3" />
      <path d="M3.8 19.2c.5-3 2.6-4.8 5.4-4.8s4.9 1.8 5.4 4.8" />
      <path d="M15.6 6.2a2.8 2.8 0 0 1 0 5.4M17.2 14.9c1.8.5 3 2.1 3.4 4.3" />
    </svg>
  );
}

/** 공유주방 — 냄비 */
function KitchenGlyph(props: GlyphProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 10.4h16v4.2a4.6 4.6 0 0 1-4.6 4.6H8.6A4.6 4.6 0 0 1 4 14.6v-4.2Z" />
      <path d="M2.4 10.4h19.2M7.6 10.4V8.2M16.4 10.4V8.2" />
      <path d="M9.4 6.8c-.6-.8-.6-1.6 0-2.4M14.6 6.8c.6-.8.6-1.6 0-2.4" />
    </svg>
  );
}

/** 루프탑 — 건물과 해 */
function RooftopGlyph(props: GlyphProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.4 20.2V12a1.6 1.6 0 0 1 1.6-1.6h6.6A1.6 1.6 0 0 1 13.2 12v8.2" />
      <path d="M2.6 20.4h18.8" />
      <path d="M15.4 20.2v-4.4h3.4a1.4 1.4 0 0 1 1.4 1.4v3" />
      <path d="M18.6 6.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2Z" />
      <path d="M7.4 15.6h1.6M7.4 18h1.6" />
    </svg>
  );
}

/** 스터디룸 — 펼친 책 */
function StudyGlyph(props: GlyphProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 7.2C10.4 5.9 8.3 5.2 5.6 5.2c-.7 0-1.2.5-1.2 1.2v10.4c0 .7.5 1.2 1.2 1.2 2.7 0 4.8.7 6.4 2 1.6-1.3 3.7-2 6.4-2 .7 0 1.2-.5 1.2-1.2V6.4c0-.7-.5-1.2-1.2-1.2-2.7 0-4.8.7-6.4 2Z" />
      <path d="M12 7.2v12.8" />
    </svg>
  );
}

const GLYPHS: Record<Category | "all", (props: GlyphProps) => React.ReactElement> = {
  all: AllGlyph,
  party: PartyGlyph,
  kidsroom: KidsGlyph,
  practice: PracticeGlyph,
  studio: StudioGlyph,
  meeting: MeetingGlyph,
  kitchen: KitchenGlyph,
  rooftop: RooftopGlyph,
  study: StudyGlyph,
};

export function CategoryGlyph({ category, ...props }: GlyphProps & { category: Category | "all" }) {
  const Glyph = GLYPHS[category] ?? AllGlyph;
  return <Glyph {...props} />;
}
