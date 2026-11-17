import { CATEGORY_MAP, DEMO_ACCOUNTS } from "@/lib/constants";
import { cn } from "@/lib/format";
import type { Category, Role } from "@/lib/types";

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
  const items: { key: Category | "all"; label: string; emoji: string }[] = [
    { key: "all", label: "전체", emoji: "✨" },
    ...Object.values(CATEGORY_MAP).map((category) => ({
      key: category.key,
      label: category.label,
      emoji: category.emoji,
    })),
  ];
  return (
    <div className={cn("no-scrollbar flex gap-2 overflow-x-auto", className)}>
      {items.map((item) => {
        const isActive = active === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key)}
            className={cn(
              "chip",
              size === "sm" && "px-3 py-1.5 text-xs",
              isActive && "chip-active"
            )}
            aria-pressed={isActive}
          >
            <span aria-hidden>{item.emoji}</span>
            {item.label}
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
