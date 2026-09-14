import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect } from "react";

import { FeaturedSlideshow } from "@/components/FeaturedSlideshow";
import { buildPosterIndex, FilterBar, filterItems, useMediaFilter } from "@/components/FilterBar";
import { Row } from "@/components/Row";
import { TopNav } from "@/components/TopNav";
import { getSessionFn } from "@/lib/auth.functions";
import { getHomeFn, getRecommendationsFn } from "@/lib/jellyfin.functions";
import { listPostersFn, syncPostersFn } from "@/lib/posters.functions";
import { useLanguage } from "@/lib/i18n";

export const homeQuery = queryOptions({
  queryKey: ["home"],
  queryFn: () => getHomeFn(),
  // Progress can change on another device (phone -> TV), so never serve stale rows.
  staleTime: 0,
  refetchOnMount: "always" as const,
  refetchOnWindowFocus: true,
});

const recommendationsQuery = queryOptions({
  queryKey: ["recommendations"],
  queryFn: () => getRecommendationsFn(),
  staleTime: 10 * 60 * 1000,
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
    return { signedIn: Boolean(session) };
  },
  loader: async ({ context }) => {
    const session = await getSessionFn();
    if (!session) return; // public landing for visitors
    try {
      await Promise.all([
        context.queryClient.ensureQueryData(homeQuery),
        context.queryClient.ensureQueryData(postersQuery),
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Unauthorized")) return;
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
  const { data, refetch } = useSuspenseQuery(homeQuery);

  // TV/phone apps resume from background without a window focus event.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, [refetch]);

  const { data: posters = [] } = useSuspenseQuery(postersQuery);
  const { data: recommended } = useQuery(recommendationsQuery);
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

      <div className="relative z-10 mt-4 space-y-10 sm:-mt-10">
        <div className="px-4 sm:px-8">
          <FilterBar posters={posters} value={filter} onChange={setFilter} />
        </div>
        <Row
          title={t("continueWatching")}
          items={filterItems(data.resume, filter, posterIndex)}
          playDirect
        />
        {(recommended?.items.length ?? 0) > 0 && (
          <Row
            title={
              recommended?.seedTitle
                ? `${t("becauseYouWatched")} ${recommended.seedTitle}`
                : t("recommended")
            }
            items={filterItems(recommended?.items ?? [], filter, posterIndex)}
          />
        )}
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
