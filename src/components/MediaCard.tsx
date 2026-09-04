import { Link } from "@tanstack/react-router";

import { itemImageUrl, posterOf, type JfItem } from "@/lib/jellyfin.types";

export function MediaCard({ item }: { item: JfItem }) {
  const poster = posterOf(item);
  const pct = item.UserData?.PlayedPercentage ?? 0;

  return (
    <Link
      to="/title/$id"
      params={{ id: item.Type === "Episode" && item.SeriesId ? item.SeriesId : item.Id }}
      className="group relative block w-28 shrink-0 snap-start sm:w-40 md:w-44"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-muted transition-transform duration-300 group-hover:scale-105 group-hover:ring-2 group-hover:ring-primary/60">
        <img
          src={itemImageUrl(poster.id, poster.type, 400)}
          alt={item.Name}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        {pct > 0 && pct < 95 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-foreground/20">
            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
        )}
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
