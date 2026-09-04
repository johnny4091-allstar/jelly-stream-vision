import { Link } from "@tanstack/react-router";
import { Play } from "lucide-react";

import type { JfItem } from "@/lib/jellyfin.types";
import { itemImageUrl, posterOf } from "@/lib/jellyfin.types";

/**
 * Mobile-only home screen: a full-width, swipeable rail of large posters.
 * Snap scrolling, no typing required — swipe and tap.
 */
export function MobilePosterRail({ items }: { items: JfItem[] }) {
  if (!items.length) return null;
  return (
    <div className="sm:hidden">
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const title = item.SeriesName ?? item.Name;
          return (
            <Link
              key={item.Id}
              to="/title/$id"
              params={{ id: item.Type === "Episode" && item.SeriesId ? item.SeriesId : item.Id }}
              className="group relative w-[68vw] max-w-[300px] shrink-0 snap-center overflow-hidden rounded-2xl border border-border/60 bg-card shadow-lg"
            >
              <img
                src={itemImageUrl(posterOf(item).id, posterOf(item).type, 600)}
                alt={title}
                loading="lazy"
                className="aspect-[2/3] w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 space-y-1 p-3">
                <p className="truncate text-base font-bold text-white">{title}</p>
                <div className="flex items-center gap-2 text-[11px] text-white/70">
                  {item.ProductionYear && <span>{item.ProductionYear}</span>}
                  {item.OfficialRating && (
                    <span className="rounded border border-white/30 px-1 py-px text-[10px]">
                      {item.OfficialRating}
                    </span>
                  )}
                </div>
                <span className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-bold text-black">
                  <Play className="h-3.5 w-3.5 fill-current" /> Details
                </span>
              </div>
            </Link>
          );
        })}
      </div>
      <p className="px-4 pb-1 text-center text-[11px] text-muted-foreground">
        Swipe to browse · tap a poster for details
      </p>
    </div>
  );
}
