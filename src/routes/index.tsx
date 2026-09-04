import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Info, Play } from "lucide-react";

import { Row } from "@/components/Row";
import { TopNav } from "@/components/TopNav";
import { getSessionFn } from "@/lib/auth.functions";
import { getHomeFn } from "@/lib/jellyfin.functions";
import { backdropUrl, formatRuntime } from "@/lib/jellyfin.types";

const homeQuery = queryOptions({
  queryKey: ["home"],
  queryFn: () => getHomeFn(),
});

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (!session) throw redirect({ to: "/login" });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQuery),
  head: () => ({
    meta: [
      { title: "Aurora — Home" },
      { name: "description", content: "Browse your movies and shows on Aurora." },
      { property: "og:title", content: "Aurora — Home" },
      { property: "og:description", content: "Browse your movies and shows on Aurora." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { data } = useSuspenseQuery(homeQuery);
  const hero = data.hero;

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNav userName={data.userName} />

      {hero && (
        <div className="relative h-[58vh] min-h-[340px] w-full overflow-hidden sm:h-[70vh] sm:min-h-[420px]">
          <img
            src={backdropUrl(hero)}
            alt={hero.Name}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-background/20" />
          <div className="absolute inset-x-0 bottom-0 space-y-3 px-4 pb-12 sm:space-y-4 sm:px-8 sm:pb-16">
            <h1 className="max-w-2xl text-3xl font-black tracking-tight text-foreground drop-shadow-lg sm:text-6xl">
              {hero.SeriesName ?? hero.Name}
            </h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {hero.ProductionYear && <span>{hero.ProductionYear}</span>}
              {hero.OfficialRating && (
                <span className="rounded border border-border px-1.5 py-0.5 text-xs">
                  {hero.OfficialRating}
                </span>
              )}
              {hero.RunTimeTicks ? <span>{formatRuntime(hero.RunTimeTicks)}</span> : null}
            </div>
            {hero.Overview && (
              <p className="line-clamp-2 max-w-xl text-xs text-foreground/85 sm:line-clamp-3 sm:text-base">
                {hero.Overview}
              </p>
            )}
            <div className="flex items-center gap-3 pt-2">
              <Link
                to="/watch/$id"
                params={{ id: hero.Id }}
                className="inline-flex items-center gap-2 rounded-md bg-foreground px-5 py-2 text-xs font-bold text-background transition-colors hover:bg-foreground/80 sm:px-6 sm:py-2.5 sm:text-sm"
              >
                <Play className="h-5 w-5 fill-current" /> Play
              </Link>
              <Link
                to="/title/$id"
                params={{ id: hero.Type === "Episode" && hero.SeriesId ? hero.SeriesId : hero.Id }}
                className="inline-flex items-center gap-2 rounded-md bg-accent/80 px-5 py-2 text-xs font-bold text-accent-foreground transition-colors hover:bg-accent sm:px-6 sm:py-2.5 sm:text-sm"
              >
                <Info className="h-5 w-5" /> More Info
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 -mt-10 space-y-10">
        <Row title="Continue Watching" items={data.resume} />
        <Row title="Next Up" items={data.nextUp} />
        {data.rows.map((row) => (
          <div key={row.viewId}>
            <Row title={row.title} items={row.items} />
            <div className="px-4 sm:px-8">
              <Link
                to="/library/$id"
                params={{ id: row.viewId }}
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                Browse all →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
