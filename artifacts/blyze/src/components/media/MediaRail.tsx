import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";

type MediaRailProps = {
  label: string;
  children: ReactNode;
  className?: string;
  itemClassName?: string;
};

/**
 * A stable, focusable horizontal rail. It relies on native scroll snapping for
 * touch/trackpad use and adds keyboard-visible paging controls for desktop and
 * future TV/remote navigation without requiring hover-only interaction.
 */
export function MediaRail({
  label,
  children,
  className,
  itemClassName,
}: MediaRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const railId = useId();

  const scroll = (direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({
      left: direction * Math.max(rail.clientWidth * 0.82, 320),
      behavior: "smooth",
    });
  };

  return (
    <div className={`group/media-rail relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => scroll(-1)}
        aria-label={`Scroll ${label} left`}
        aria-controls={railId}
        className="absolute inset-y-0 left-0 z-10 hidden w-12 items-center justify-center bg-gradient-to-r from-[#080a10]/95 via-[#080a10]/55 to-transparent text-white transition hover:text-primary focus-visible:flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary md:group-hover/media-rail:flex"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <div
        id={railId}
        ref={railRef}
        role="region"
        aria-label={label}
        aria-keyshortcuts="ArrowLeft ArrowRight"
        tabIndex={0}
        onKeyDown={(event) => {
          // Preserve child-card keyboard behavior. Rail paging applies only when
          // the rail itself owns focus, which also maps cleanly to TV remotes.
          if (event.target !== event.currentTarget) return;
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            scroll(-1);
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            scroll(1);
          }
        }}
        className={`kryv-media-rail -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:mx-0 sm:px-0 ${itemClassName ?? ""}`}
      >
        {children}
      </div>
      <button
        type="button"
        onClick={() => scroll(1)}
        aria-label={`Scroll ${label} right`}
        aria-controls={railId}
        className="absolute inset-y-0 right-0 z-10 hidden w-12 items-center justify-center bg-gradient-to-l from-[#080a10]/95 via-[#080a10]/55 to-transparent text-white transition hover:text-primary focus-visible:flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary md:group-hover/media-rail:flex"
      >
        <ChevronRight className="h-6 w-6" />
      </button>
    </div>
  );
}

export function MediaRailSkeleton({
  cards = 5,
  portrait = false,
  label = "Loading media",
}: {
  cards?: number;
  portrait?: boolean;
  label?: string;
}) {
  return (
    <div
      className="-mx-4 flex gap-3 overflow-hidden px-4 pb-4 sm:mx-0 sm:px-0"
      role="status"
      aria-label={label}
    >
      {Array.from({ length: cards }, (_, index) => (
        <div
          key={index}
          className={`${portrait ? "w-[142px] aspect-[2/3] sm:w-[174px]" : "w-[78vw] aspect-video sm:w-72"} shrink-0 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.045]`}
        />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}
