import { cn } from "@/lib/format";

const PINK = "#FF2E7E";
const PINK_HOT = "#F01D71";
const PINK_DEEP = "#B80D54";
const PINK_LIGHT = "#FF6FA5";

export function LogoMark({
  size = 36,
  className,
  shadow = true,
  decorative = false,
}: {
  size?: number;
  className?: string;
  shadow?: boolean;
  decorative?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={cn("shrink-0", className)}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "이곳저곳"}
      aria-hidden={decorative || undefined}
    >
      {shadow && <ellipse cx="31" cy="60.6" rx="12.4" ry="2.5" fill="#FFD9E9" />}
      {/* 지도 핀 */}
      <path
        d="M32 4.2C19.9 4.2 10.1 14 10.1 26.1c0 6.7 3.4 13 8.5 18.7 4.6 5.1 9.8 8.9 12.7 11.1.4.3 1 .3 1.4 0 2.9-2.2 8.1-6 12.7-11.1 5.1-5.7 8.5-12 8.5-18.7C53.9 14 44.1 4.2 32 4.2Z"
        fill={PINK}
      />
      {/* 아치문 화이트 하우스 */}
      <path
        d="M32 18.6c.36 0 .71.14.98.4l10.4 9.5c.3.27.47.66.47 1.06v10.9c0 1.5-1.22 2.72-2.72 2.72H21.87a2.72 2.72 0 0 1-2.72-2.72V29.56c0-.4.17-.79.47-1.06l10.4-9.5c.27-.26.62-.4.98-.4Z"
        fill="#FFFFFF"
      />
      <path
        d="M28.3 43.2v-6.1a3.7 3.7 0 0 1 7.4 0v6.1h-7.4Z"
        fill={PINK_HOT}
      />
      {/* 스파클 2획 */}
      <path d="M52.2 15.1 56.6 10.9" stroke={PINK_LIGHT} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M55.6 22.8 60.6 20.4" stroke={PINK_LIGHT} strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

export function SloganUnderline({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 8"
      preserveAspectRatio="none"
      className={cn("pointer-events-none absolute inset-x-0 h-[5px]", className)}
      aria-hidden
    >
      <path
        d="M2 6.2C22 1.6 55 1.2 98 4.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** `이곳저곳` 글씨 위 핫핑크 포물선 아치 + 스파클 */
export function Wordmark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const textSize = size === "lg" ? "text-[28px]" : size === "sm" ? "text-[15px]" : "text-[21px]";
  return (
    <span className={cn("relative inline-flex flex-col", className)}>
      <svg
        viewBox="0 0 100 12"
        preserveAspectRatio="none"
        className="absolute -top-[12px] left-[3%] h-[11px] w-[94%] text-brand"
        aria-hidden
      >
        <path
          d="M4 9.4C20 2.6 54 0.8 94 4.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      </svg>
      <span
        className={cn(
          "font-black leading-none tracking-[-0.045em] text-ink",
          textSize
        )}
      >
        이곳저곳
      </span>
    </span>
  );
}

export function Slogan({ className, size = "sm" }: { className?: string; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center gap-x-1 font-bold leading-[1.4] tracking-tight text-ink-soft",
        size === "sm" ? "text-[11.5px]" : "text-sm",
        className
      )}
    >
      <span className="whitespace-nowrap">찾고, 예약하고, 결제까지</span>
      <span className="text-ink-mute">—</span>
      <span className="relative inline-block whitespace-nowrap font-extrabold text-brand">
        한 번에!
        <SloganUnderline className="-bottom-[3px] text-brand" />
      </span>
    </span>
  );
}

export function BrandLogo({
  size = 34,
  compact = false,
  className,
}: {
  size?: number;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark size={size} />
      <Wordmark size={compact ? "sm" : "md"} />
    </span>
  );
}

/** 마스코트 원형 아바타 */
export function MascotAvatar({
  size = 64,
  className,
  ring = true,
}: {
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-brand-light",
        ring && "ring-2 ring-white shadow-card",
        className
      )}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/mascot-avatar.webp"
        alt="이곳저곳 마스코트"
        className="h-full w-full object-cover"
        loading="lazy"
      />
    </span>
  );
}

export { PINK, PINK_DEEP };
