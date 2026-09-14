import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";

import { MediaCard } from "@/components/MediaCard";
import { TopNav } from "@/components/TopNav";
import { getSessionFn } from "@/lib/auth.functions";
import { getWatchlistFn } from "@/lib/jellyfin.functions";

const watchlistQueryOptions = queryOptions({
  queryKey: ["watchlist"],
  queryFn: () => getWatchlistFn(),
  staleTime: 0, // always fresh — items change when you add/remove
});

export const Route = createFileRoute("/watchlist")({
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (!session) throw redirect({ to: "/login" });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(watchlistQueryOptions),
  head: () => ({
    meta: [
      { title: "My Watchlist — Aurora" },
      { name: "description", content: "Movies and shows you want to watch next on Aurora." },
      { property: "og:title", content: "My Watchlist — Aurora" },
      { property: "og:description", content: "Movies and shows you want to watch next on Aurora." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WatchlistPage,
});

function WatchlistPage() {
  const { data: items } = useSuspenseQuery(watchlistQueryOptions);

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNav userName="" />
      <div className="space-y-8 px-4 pt-24 sm:px-8">
        <h1 className="flex items-center gap-3 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          <Bookmark className="h-6 w-6 fill-primary text-primary" />
          My Watchlist
        </h1>
        {items.length === 0 ? (
          <p className="max-w-md text-sm text-muted-foreground">
            Nothing here yet. Tap the bookmark on any poster, or use "My List" on a
            title's page, to save what you want to watch next. Rate it from the
            title page when you're done.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
            {items.map((item) => (
              <MediaCard key={item.Id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
