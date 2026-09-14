import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";

import { FeaturedSlideshow } from "@/components/FeaturedSlideshow";
import { buildPosterIndex, FilterBar, filterItems, useMediaFilter } from "@/components/FilterBar";
import { Row } from "@/components/Row";
import { TopNav } from "@/components/TopNav";
import { getSessionFn } from "@/lib/auth.functions";
import { getHomeFn } from "@/lib/jellyfin.functions";
import { listPostersFn, syncPostersFn } from "@/lib/posters.functions";
import { useLanguage } from "@/lib/i18n";

const homeQuery = queryOptions({
  queryKey: ["home"],
  queryFn: () => getHomeFn(),
});

const postersQuery = queryOptions({
  queryKey: ["posters"],
  queryFn: async () => {
    let rows = await listPostersFn();
    if (!rows.length) {
      await syncPostersFn();
      rows = await listPostersFn();
    }
    return rows;
  },
});

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (!session) throw redirect({ to: "/login" });
  },
  loader: async ({ context }) => {
    try {
      await Promise.all([
        context.queryClient.ensureQueryData(homeQuery),
        context.queryClient.ensureQueryData(postersQuery),
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Unauthorized")) throw redirect({ to: "/login" });
      throw err;
    }
  },
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
  const { t } = useLanguage();
  const { data } = useSuspenseQuery(homeQuery);
  const { data: posters = [] } = useSuspenseQuery(postersQuery);
  const [filter, setFilter] = useMediaFilter();
  const posterIndex = buildPosterIndex(posters);
  const featured = [
    ...(data.hero ? [data.hero] : []),
    ...data.resume,
    ...data.nextUp,
    ...data.rows.flatMap((row) => row.items),
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNav userName={data.userName} />

      <FeaturedSlideshow items={featured} />

      <div className="relative z-10 -mt-10 space-y-10">
        <div className="px-4 sm:px-8">
          <FilterBar posters={posters} value={filter} onChange={setFilter} />
        </div>
        <Row title={t("continueWatching")} items={filterItems(data.resume, filter, posterIndex)} />
        <Row title={t("nextUp")} items={filterItems(data.nextUp, filter, posterIndex)} />
        {data.rows.map((row) => (
          <div key={row.viewId}>
            <Row title={row.title} items={filterItems(row.items, filter, posterIndex)} />

            <div className="px-4 sm:px-8">
              <Link
                to="/library/$id"
                params={{ id: row.viewId }}
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                {t("browseAll")} →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
