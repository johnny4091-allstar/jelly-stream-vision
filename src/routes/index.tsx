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
    if (!context.signedIn) return; // public landing for visitors
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
  errorComponent: ({ error }) => {
    // Signed-in home failed to load (e.g. expired session) — send to login.
    if (typeof window !== "undefined") window.location.href = "/login";
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Redirecting to sign in… {error instanceof Error ? error.message : ""}
      </div>
    );
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
  const { signedIn } = Route.useRouteContext();
  if (!signedIn) return <LandingPage />;
  return <SignedInHome />;
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <span className="text-2xl font-black tracking-tight text-primary">AURORA</span>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="rounded-md px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:text-primary"
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-transform hover:scale-105"
          >
            Sign up free
          </Link>
        </div>
      </header>

      <section className="flex flex-col items-center px-6 pb-20 pt-16 text-center sm:pt-24">
        <h1 className="max-w-3xl text-4xl font-black leading-tight sm:text-6xl">
          Your movies, shows and <span className="text-primary">live TV</span> — all in one place
        </h1>
        <p className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
          Stream in HD with synced progress across your phone, TV and browser. Browse thousands of
          live channels with a full TV guide, recordings and watchlist.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/signup"
            className="rounded-md bg-primary px-8 py-3 text-lg font-bold text-primary-foreground transition-transform hover:scale-105"
          >
            Get started
          </Link>
          <Link
            to="/guide"
            className="rounded-md border border-border px-8 py-3 text-lg font-semibold transition-colors hover:border-primary hover:text-primary"
          >
            See the TV guide
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-8 px-6 pb-24 sm:grid-cols-3">
        {[
          {
            title: "Movies & shows",
            body: "A Netflix-style library with Continue Watching, recommendations and instant search.",
          },
          {
            title: "Live TV & guide",
            body: "Thousands of live channels with a full schedule grid, now-and-next and one-tap recording.",
          },
          {
            title: "Everywhere you watch",
            body: "Phone, Android TV and web — your progress, watchlist and recordings sync instantly.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-xl border border-border bg-card p-6 text-left shadow-[0_0_30px_-12px_var(--glow-primary)]"
          >
            <h2 className="text-lg font-bold">{f.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border px-6 py-8 text-center text-xs text-muted-foreground">
        Aurora — sign up and start watching in minutes.
      </footer>
    </div>
  );
}

function SignedInHome() {
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
