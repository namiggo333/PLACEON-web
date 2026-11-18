import { cn } from "@/lib/format";

const ORANGE = "#FF6B00";
const ORANGE_LIGHT = "#FF8A2B";
const PEACH = "#FFE1CA";

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
      {shadow && <ellipse cx="32" cy="60.4" rx="12.8" ry="2.7" fill={PEACH} />}
      <path
        d="M32 4.6C19.9 4.6 10.1 14.4 10.1 26.5c0 6.7 3.4 12.9 8.5 18.6 4.6 5.1 9.8 8.9 12.7 11.1.4.3 1 .3 1.4 0 2.9-2.2 8.1-6 12.7-11.1 5.1-5.7 8.5-11.9 8.5-18.6C53.9 14.4 44.1 4.6 32 4.6Z"
        fill={ORANGE}
        stroke={ORANGE}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M32 19.6c.3 0 .6.12.83.35l10.2 9.4c.28.26.44.63.44 1.02v9.5c0 1.5-1.22 2.73-2.73 2.73H21.86a2.73 2.73 0 0 1-2.73-2.73v-9.5c0-.39.16-.76.44-1.02l10.2-9.4c.23-.23.53-.35.83-.35Z"
        fill="#FFFFFF"
      />
      <path d="M27.3 43.6v-6.4a4.7 4.7 0 0 1 9.4 0v6.4h-9.4Z" fill={ORANGE} />
      <path d="M51.8 14.4 56 10.2" stroke={ORANGE_LIGHT} strokeWidth="3.4" strokeLinecap="round" />
      <path d="M54.6 21.8 59.6 19.7" stroke={ORANGE_LIGHT} strokeWidth="3.4" strokeLinecap="round" />
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
        stroke={ORANGE}
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Slogan({ className, size = "sm" }: { className?: string; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "relative flex flex-col font-bold leading-[1.35] tracking-tight text-ink",
        size === "sm" ? "text-[12px]" : "text-sm",
        className
      )}
    >
      <span className="text-ink">원하는 공간,</span>
      <span className="whitespace-nowrap text-ink">
        <span className="relative inline-block font-extrabold text-brand">
          여기저기
          <SloganUnderline className="-bottom-[4px]" />
        </span>{" "}
        한곳에서
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
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-black tracking-[-0.03em] text-ink",
            compact ? "text-[19px]" : "text-[22px]"
          )}
        >
          이곳저곳
        </span>
      </span>
    </span>
  );
}
