import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Tv } from "lucide-react";

import { getPublicGuideFn, type GuideProgram } from "@/lib/livetv.functions";

const guideQuery = {
  queryKey: ["public-guide"],
  queryFn: () => getPublicGuideFn(),
  staleTime: 60_000,
};

export const Route = createFileRoute("/guide")({
  loader: ({ context }) => context.queryClient.ensureQueryData(guideQuery),
  head: () => ({
    meta: [
      { title: "TV Guide — Aurora" },
      {
        name: "description",
        content:
          "Browse Aurora's live TV guide: channels, what's on now and what's coming up next. Sign up to watch.",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "TV Guide — Aurora" },
      {
        property: "og:description",
        content:
          "Browse Aurora's live TV guide: channels, what's on now and what's coming up next. Sign up to watch.",
      },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicGuidePage,
});

function fmtTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function PublicGuidePage() {
  const { data } = useSuspenseQuery(guideQuery);
  const now = Date.now();
  const byChannel = new Map<string, GuideProgram[]>();
  for (const p of data.programs) {
    const list = byChannel.get(p.channelId) ?? [];
    list.push(p);
    byChannel.set(p.channelId, list);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/90 px-6 py-4 backdrop-blur sm:px-10">
        <Link to="/" className="text-2xl font-black tracking-tight text-primary">
          AURORA
        </Link>
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

      <main className="mx-auto max-w-4xl px-6 py-10 sm:px-10">
        <h1 className="flex items-center gap-3 text-3xl font-black">
          <Tv className="size-8 text-primary" /> TV Guide
        </h1>
        <p className="mt-2 text-muted-foreground">
          What's on now and next. Sign up to watch any channel live.
        </p>

        <ul className="mt-8 divide-y divide-border rounded-xl border border-border bg-card">
          {data.channels.map((ch) => {
            const programs = byChannel.get(ch.id) ?? [];
            const current = programs.find(
              (p) =>
                p.start && p.end && new Date(p.start).getTime() <= now && new Date(p.end).getTime() > now,
            );
            const next = programs.find((p) => p.start && new Date(p.start).getTime() > now);
            return (
              <li key={ch.id} className="flex items-center gap-4 p-4">
                {ch.hasImage ? (
                  <img
                    src={`/api/proxy/Items/${ch.id}/Images/Primary?maxWidth=160&quality=80`}
                    alt={ch.name}
                    loading="lazy"
                    className="size-14 shrink-0 rounded-md object-cover"
                    onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                  />
                ) : (
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Tv className="size-6 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">
                    {ch.number && <span className="mr-2 text-muted-foreground">{ch.number}</span>}
                    {ch.name}
                  </p>
                  {current && (
                    <p className="truncate text-sm">
                      <span className="mr-2 rounded bg-primary/15 px-1.5 py-0.5 text-xs font-bold text-primary">
                        ON NOW
                      </span>
                      {current.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        until {fmtTime(current.end)}
                      </span>
                    </p>
                  )}
                  {next && (
                    <p className="truncate text-sm text-muted-foreground">
                      Next: {next.name} · {fmtTime(next.start)}
                    </p>
                  )}
                </div>
                <Link
                  to="/signup"
                  className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-transform hover:scale-105"
                >
                  Watch
                </Link>
              </li>
            );
          })}
          {!data.channels.length && (
            <li className="p-8 text-center text-muted-foreground">
              The guide is unavailable right now — please check back soon.
            </li>
          )}
        </ul>
      </main>
    </div>
  );
}
