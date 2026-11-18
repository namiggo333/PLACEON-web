import { ALL_CATEGORY_STYLE, CATEGORY_MAP, DEMO_ACCOUNTS } from "@/lib/constants";
import { cn } from "@/lib/format";
import type { Category, Role } from "@/lib/types";
import { CategoryGlyph } from "./CategoryIcons";

export function CategoryChips({
  active,
  onSelect,
  className,
  size = "md",
}: {
  active: Category | "all";
  onSelect: (value: Category | "all") => void;
  className?: string;
  size?: "md" | "sm";
}) {
  const items = [ALL_CATEGORY_STYLE, ...Object.values(CATEGORY_MAP)];
  return (
    <div className={cn("no-scrollbar flex gap-1.5 overflow-x-auto pb-1 sm:gap-3", className)}>
      {items.map((item) => {
        const isActive = active === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key)}
            className="group flex w-[66px] shrink-0 flex-col items-center gap-1.5 rounded-2xl py-1 outline-none focus-visible:ring-2 focus-visible:ring-brand/40 sm:w-[76px]"
            aria-pressed={isActive}
          >
            <span
              className={cn(
                "grid place-items-center rounded-full transition duration-200",
                size === "sm" ? "h-12 w-12" : "h-[56px] w-[56px] sm:h-[60px] sm:w-[60px]",
                isActive
                  ? "bg-brand text-white shadow-pop"
                  : cn(item.pastel, item.tone, "group-hover:-translate-y-0.5 group-hover:shadow-card")
              )}
            >
              <CategoryGlyph category={item.key} size={size === "sm" ? 22 : 26} />
            </span>
            <span
              className={cn(
                "text-center font-display text-[12.5px] leading-tight tracking-tight transition",
                isActive ? "text-brand" : "text-ink-soft group-hover:text-ink"
              )}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function DemoAccountButtons({
  onPick,
  busy,
  compact = false,
}: {
  onPick: (role: Role) => void;
  busy?: Role | null;
  compact?: boolean;
}) {
  return (
    <div className={cn("grid gap-2", compact ? "grid-cols-1" : "grid-cols-2")}>
      {(["guest", "host"] as Role[]).map((role) => {
        const account = DEMO_ACCOUNTS[role];
        return (
          <button
            key={role}
            type="button"
            disabled={Boolean(busy)}
            onClick={() => onPick(role)}
            className="group flex items-center gap-2.5 rounded-xl border border-ink-line bg-white px-3 py-2.5 text-left transition hover:border-brand/50 hover:bg-brand-light/60 disabled:opacity-60"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-light text-base">
              {role === "guest" ? "🙋" : "🧑‍💼"}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-bold text-ink">
                {busy === role ? "로그인 중…" : `${account.name} ${role === "guest" ? "게스트" : "사장님"}`}
              </span>
              <span className="block truncate text-[10px] text-ink-mute">
                {account.email} · 바로 로그인
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
