import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bookmark, Play } from "lucide-react";
import { useState } from "react";

import { setFavoriteFn } from "@/lib/jellyfin.functions";
import { itemImageUrl, posterOf, type JfItem } from "@/lib/jellyfin.types";

/** Poster candidates, best first: series art, own art, backdrop art. */
function posterCandidates(item: JfItem): string[] {
  const urls: string[] = [];
  const poster = posterOf(item);
  urls.push(itemImageUrl(poster.id, poster.type, 400));
  if (poster.id !== item.Id) urls.push(itemImageUrl(item.Id, "Primary", 400));
  if (item.ParentBackdropItemId) {
    urls.push(`/api/proxy/Items/${item.ParentBackdropItemId}/Images/Backdrop/0?maxWidth=400&quality=80`);
  }
  urls.push(`/api/proxy/Items/${item.Id}/Images/Backdrop/0?maxWidth=400&quality=80`);
  return urls;
}

export function MediaCard({ item, playDirect = false }: { item: JfItem; playDirect?: boolean }) {
  const pct = item.UserData?.PlayedPercentage ?? 0;
  const [inWatchlist, setInWatchlist] = useState(item.UserData?.IsFavorite ?? false);
  const [busy, setBusy] = useState(false);
  const [imgStep, setImgStep] = useState(0);
  const queryClient = useQueryClient();
  const setFavorite = useServerFn(setFavoriteFn);

  const candidates = posterCandidates(item);
  const src = candidates[Math.min(imgStep, candidates.length - 1)];

  const linkProps = item.Type === "TvChannel"
    ? ({ to: "/live/watch/$channelId", params: { channelId: item.Id } } as const)
    : playDirect
    ? ({ to: "/watch/$id", params: { id: item.Id } } as const)
    : ({
        to: "/title/$id",
        params: { id: item.Type === "Episode" && item.SeriesId ? item.SeriesId : item.Id },
      } as const);

  return (
    <Link
      {...linkProps}
      tabIndex={0}
      className="group relative block w-28 shrink-0 snap-start scroll-mx-8 sm:w-40 md:w-44"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-muted transition-transform duration-300 group-hover:scale-105 group-hover:ring-2 group-hover:ring-primary/60 group-focus-visible:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-primary">
        <img
          src={src}
          alt={item.Name}
          loading="lazy"
          onError={() => setImgStep((s) => (s < candidates.length - 1 ? s + 1 : s))}
          className="h-full w-full object-cover"
        />
        {playDirect && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <span className="rounded-full bg-background/70 p-3 backdrop-blur-sm">
              <Play className="h-5 w-5 fill-current text-foreground" />
            </span>
          </span>
        )}
        {pct > 0 && pct < 95 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-foreground/20">
            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
        )}
        <button
          type="button"
          disabled={busy}
          aria-pressed={inWatchlist}
          aria-label={inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const next = !inWatchlist;
            setInWatchlist(next);
            setBusy(true);
            void setFavorite({ data: { itemId: item.Id, favorite: next } })
              .then(() => queryClient.invalidateQueries({ queryKey: ["watchlist"] }))
              .finally(() => setBusy(false));
          }}
          className={`absolute right-1.5 top-1.5 rounded-full p-1.5 backdrop-blur-sm transition-opacity ${
            inWatchlist
              ? "bg-primary text-primary-foreground"
              : "bg-background/60 text-foreground/90 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          }`}
        >
          <Bookmark className={`h-3.5 w-3.5 ${inWatchlist ? "fill-current" : ""}`} />
        </button>
      </div>
      <p className="mt-1.5 truncate text-xs font-medium text-foreground/90 sm:mt-2 sm:text-sm">
        {item.SeriesName ?? item.Name}
      </p>
      {item.Type === "Episode" && (
        <p className="truncate text-xs text-muted-foreground">{item.Name}</p>
      )}
    </Link>
  );
}
