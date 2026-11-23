import Image from "next/image";
import Link from "next/link";
import { CATEGORY_MAP } from "@/lib/constants";
import { cn, won } from "@/lib/format";
import type { Space } from "@/lib/types";
import { UsersIcon } from "./Icons";
import { MascotAvatar } from "./Logo";

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
      <span className={cn("relative block h-full w-full overflow-hidden", className)}>
        <Image
          src={cover}
          alt={space.name}
          fill
          sizes="(max-width: 640px) 112px, (max-width: 1024px) 46vw, 300px"
          className="object-cover"
        />
      </span>
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
        <span className="absolute bottom-3 left-3 rounded-md bg-white/85 px-2 py-0.5 text-[12px] font-bold text-ink">
          {category.label}
        </span>
      )}
    </div>
  );
}

/**
 * 카드에 붙는 상태 배지는 최대 2개. 우선순위는 `마감 > 타임특가`.
 * "AD"(상단 노출 광고)는 배지가 아니라 사진 위 작은 '광고' 라벨로 분리했다.
 */
export function SpaceCard({
  space,
  className,
  soldOut = false,
}: {
  space: Space;
  className?: string;
  /** 오늘 예약 가능한 시간이 하나도 없으면 true (홈에서 일괄 조회해 넘긴다) */
  soldOut?: boolean;
}) {
  const discounted = space.discountRate > 0;
  const finalPrice = Math.round((space.pricePerHour * (100 - space.discountRate)) / 100);
  const category = CATEGORY_MAP[space.category] ?? CATEGORY_MAP.party;
  const showDeal = discounted && space.timeDeal && !soldOut;
  const closed = soldOut;

  return (
    <Link
      href={`/spaces/${space.id}`}
      className={cn(
        "group card flex overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-float sm:block",
        className
      )}
    >
      <div className="relative h-[124px] w-[112px] shrink-0 overflow-hidden sm:h-auto sm:w-full sm:aspect-[3/2]">
        <SpaceMedia space={space} emojiSize="text-2xl sm:text-[42px]" />

        {space.featured && (
          <span className="absolute left-1.5 top-1.5 rounded-md bg-ink/80 px-1.5 py-0.5 text-[12px] font-bold leading-4 text-white backdrop-blur sm:left-2.5 sm:top-2.5">
            광고
          </span>
        )}

        {(closed || showDeal) && (
          <div className="absolute left-1.5 bottom-1.5 flex flex-wrap gap-1 sm:left-2.5 sm:bottom-2.5">
            {closed && <span className="ui-badge ui-badge--closed">마감</span>}
            {showDeal && (
              <span className="ui-badge ui-badge--deal">타임특가 {space.discountRate}%</span>
            )}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 p-3 sm:p-3.5">
        <p className="truncate text-[12px] font-medium text-ink-mute">
          {space.region} {space.district} · {category.label}
        </p>
        <h3 className="truncate text-[15px] font-bold text-ink transition group-hover:text-brand-dark sm:text-[16px]">
          {space.name}
        </h3>
        <p className="inline-flex items-center gap-1 text-[12px] text-ink-soft">
          <UsersIcon size={12} className="text-ink-mute" />
          최대 {space.capacity}명
          {closed ? <span className="text-ink-mute"> · 오늘 마감</span> : null}
        </p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
          {discounted && (
            <span className="text-[13px] font-extrabold text-brand-strong">{space.discountRate}%</span>
          )}
          <span className="ui-price-main text-ink">{won(finalPrice)}</span>
          <span className="text-[12px] font-medium text-ink-mute">/시간</span>
          {discounted && (
            <span className="ui-price-orig ml-auto hidden sm:inline">{won(space.pricePerHour)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function SpaceGrid({
  spaces,
  soldOutIds,
  emptyTitle = "조건에 맞는 공간이 없어요",
  emptyHint = "지역이나 가격 조건을 조금 넓혀서 다시 찾아보세요.",
  onReset,
}: {
  spaces: Space[];
  soldOutIds?: Set<string>;
  emptyTitle?: string;
  emptyHint?: string;
  onReset?: () => void;
}) {
  if (!spaces.length) {
    return (
      <div className="card flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
        <MascotAvatar size={76} className="animate-floaty" />
        <p className="mt-1 text-sm font-bold text-ink">{emptyTitle}</p>
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {spaces.map((space) => (
        <SpaceCard key={space.id} space={space} soldOut={soldOutIds?.has(space.id)} />
      ))}
    </div>
  );
}
