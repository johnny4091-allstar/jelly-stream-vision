import type { JfItem } from "@/lib/jellyfin.types";

import { MediaCard } from "./MediaCard";

export function Row({ title, items }: { title: string; items: JfItem[] }) {
  if (!items.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="px-4 text-lg font-bold tracking-tight text-foreground sm:px-8 sm:text-xl">
        {title}
      </h2>
      <div className="flex snap-x gap-3 overflow-x-auto scroll-smooth px-4 pb-2 sm:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <MediaCard key={item.Id} item={item} />
        ))}
      </div>
    </section>
  );
}
