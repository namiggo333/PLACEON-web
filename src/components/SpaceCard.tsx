import Link from "next/link";
import { CATEGORY_MAP } from "@/lib/constants";
import { cn, won } from "@/lib/format";
import type { Space } from "@/lib/types";
import { StarIcon, UsersIcon } from "./Icons";

export function SpaceMedia({
  space,
  className,
  showLabel = false,
  emojiSize = "text-[42px]",
}: {
  space: Space;
  className?: string;
  showLabel?: boolean;
  emojiSize?: string;
}) {
  const category = CATEGORY_MAP[space.category] ?? CATEGORY_MAP.party;
  const cover = space.imageUrls?.[0] ?? space.imageUrl;
  if (cover) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={cover}
        alt={space.name}
        className={cn("h-full w-full object-cover", className)}
        loading="lazy"
      />
    );
  }
  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden bg-gradient-to-br",
        category.gradient,
        className
      )}
    >
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(255,255,255,.65) 0, transparent 45%), radial-gradient(circle at 85% 0%, rgba(255,255,255,.35) 0, transparent 40%), radial-gradient(rgba(255,255,255,.4) 1px, transparent 1px)",
          backgroundSize: "auto, auto, 18px 18px",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
      <span
        className={cn(
          "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 drop-shadow",
          emojiSize
        )}
      >
        {category.emoji}
      </span>
      {showLabel && (
        <span className="absolute bottom-3 left-3 rounded-md bg-white/85 px-2 py-0.5 text-[10px] font-bold text-ink">
          {category.label}
        </span>
      )}
    </div>
  );
}

export function SpaceCard({ space, className }: { space: Space; className?: string }) {
  const discounted = space.discountRate > 0;
  const finalPrice = Math.round((space.pricePerHour * (100 - space.discountRate)) / 100);

  return (
    <Link
      href={`/spaces/${space.id}`}
      className={cn(
        "group card flex overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-float sm:block",
        className
      )}
    >
      <div className="relative h-[112px] w-[112px] shrink-0 overflow-hidden sm:h-auto sm:w-full sm:aspect-[16/10]">
        <SpaceMedia space={space} emojiSize="text-2xl sm:text-[42px]" />
        <div className="absolute left-1.5 top-1.5 flex flex-col items-start gap-1 sm:left-2.5 sm:top-2.5 sm:flex-row sm:flex-wrap">
          {space.featured && (
            <span className="badge bg-ink/85 px-1.5 text-white backdrop-blur sm:px-2">AD</span>
          )}
          {space.timeDeal && discounted && (
            <span className="badge bg-brand px-1.5 text-white shadow-sm sm:px-2 sm:text-[11px]">
              <span className="sm:hidden">특가</span>
              <span className="hidden sm:inline">타임특가 {space.discountRate}%</span>
            </span>
          )}
        </div>
        <span className="badge absolute right-2.5 top-2.5 hidden bg-white/90 text-emerald-600 backdrop-blur sm:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          예약가능
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center p-3 sm:p-3.5">
        <p className="text-[10px] font-medium text-ink-mute sm:text-[11px]">
          {space.region} {space.district}
        </p>
        <h3 className="mt-0.5 truncate text-[14px] font-bold text-ink transition group-hover:text-brand sm:text-[15px]">
          {space.name}
        </h3>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-ink-soft sm:mt-1 sm:text-[11px]">
          <StarIcon size={11} className="text-amber-400" />
          {space.reviewCount > 0 ? (
            <>
              <span className="font-semibold text-ink">{space.rating.toFixed(1)}</span>
              <span className="text-ink-mute">({space.reviewCount})</span>
            </>
          ) : (
            <span className="text-ink-mute">신규 공간</span>
          )}
          <span className="text-ink-line">|</span>
          <UsersIcon size={11} />
          <span>{space.capacity}명</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 sm:mt-2.5">
          {discounted && (
            <span className="text-[11px] font-extrabold text-brand sm:text-xs">{space.discountRate}%</span>
          )}
          <span className="text-[14px] font-extrabold text-ink sm:text-[15px]">{won(finalPrice)}</span>
          <span className="text-[10px] text-ink-mute sm:text-[11px]">/시간</span>
          {discounted && (
            <span className="ml-auto hidden text-[11px] font-medium text-ink-mute line-through sm:inline">
              {won(space.pricePerHour)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function SpaceGrid({
  spaces,
  emptyTitle = "조건에 맞는 공간이 없어요",
  emptyHint = "지역이나 가격 조건을 조금 넓혀서 다시 찾아보세요.",
  onReset,
}: {
  spaces: Space[];
  emptyTitle?: string;
  emptyHint?: string;
  onReset?: () => void;
}) {
  if (!spaces.length) {
    return (
      <div className="card flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
        <span className="text-3xl">🔍</span>
        <p className="text-sm font-bold text-ink">{emptyTitle}</p>
        <p className="text-xs text-ink-mute">{emptyHint}</p>
        {onReset && (
          <button type="button" onClick={onReset} className="btn-ghost btn-sm mt-2">
            필터 초기화
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {spaces.map((space) => (
        <SpaceCard key={space.id} space={space} />
      ))}
    </div>
  );
}
