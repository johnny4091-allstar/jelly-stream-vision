import { Link } from "@tanstack/react-router";
import { Play } from "lucide-react";

import type { PosterRecord } from "@/lib/posters.types";
import { posterCoverUrl } from "@/lib/posters.types";

/**
 * Mobile-only home screen: a full-width, swipeable rail of large posters,
 * driven by the saved poster catalogue.
 */
export function MobilePosterRail({ posters }: { posters: PosterRecord[] }) {
  if (!posters.length) return null;
  return (
    <div className="sm:hidden">
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {posters.map((p) => (
          <Link
            key={p.jfItemId}
            to="/title/$id"
            params={{ id: p.jfItemId }}
            className="group relative w-[68vw] max-w-[300px] shrink-0 snap-center overflow-hidden rounded-2xl border border-border/60 bg-card shadow-lg"
          >
            <img
              src={posterCoverUrl(p, 600)}
              alt={p.title}
              loading="lazy"
              className="aspect-[2/3] w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 space-y-1 p-3">
              <p className="truncate text-base font-bold text-white">{p.title}</p>
              <div className="flex items-center gap-2 text-[11px] text-white/70">
                {p.year && <span>{p.year}</span>}
                {p.rating && (
                  <span className="rounded border border-white/30 px-1 py-px text-[10px]">
                    {p.rating}
                  </span>
                )}
                {p.genres[0] && <span className="truncate">{p.genres[0]}</span>}
              </div>
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-bold text-black">
                <Play className="h-3.5 w-3.5 fill-current" /> Details
              </span>
            </div>
          </Link>
        ))}
      </div>
      <p className="px-4 pb-1 text-center text-[11px] text-muted-foreground">
        Swipe to browse · tap a poster for details
      </p>
    </div>
  );
}
