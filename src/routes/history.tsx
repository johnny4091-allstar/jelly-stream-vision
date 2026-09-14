import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { History, Trash2 } from "lucide-react";

import { TopNav } from "@/components/TopNav";
import { getSessionFn } from "@/lib/auth.functions";
import { clearHistoryFn, getHistoryFn } from "@/lib/history.functions";

const historyQueryOptions = queryOptions({
  queryKey: ["history"],
  queryFn: () => getHistoryFn(),
  staleTime: 0, // always fresh — updates as you watch
});

export const Route = createFileRoute("/history")({
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (!session) throw redirect({ to: "/login" });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(historyQueryOptions),
  head: () => ({
    meta: [
      { title: "Watch History — Aurora" },
      { name: "description", content: "Everything you have played on Aurora and how long you watched." },
      { property: "og:title", content: "Watch History — Aurora" },
      {
        property: "og:description",
        content: "Everything you have played on Aurora and how long you watched.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoryPage,
});

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${Math.max(1, Math.floor(seconds))}s`;
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function HistoryPage() {
  const { data: entries } = useSuspenseQuery(historyQueryOptions);
  const clear = useServerFn(clearHistoryFn);
  const qc = useQueryClient();

  const totalSeconds = entries.reduce((sum, e) => sum + e.seconds_watched, 0);

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNav userName="" />
      <div className="space-y-6 px-4 pt-24 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
              <History className="h-6 w-6 text-primary" /> Watch History
            </h1>
            <p className="text-sm text-muted-foreground">
              {entries.length} title{entries.length === 1 ? "" : "s"} · {formatDuration(totalSeconds)} watched
            </p>
          </div>
          {entries.length > 0 && (
            <button
              type="button"
              onClick={async () => {
                await clear();
                await qc.invalidateQueries({ queryKey: ["history"] });
              }}
              className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Trash2 className="h-4 w-4" /> Clear
            </button>
          )}
        </div>

        {entries.length === 0 ? (
          <p className="text-muted-foreground">Nothing watched yet. Play something and it will show up here.</p>
        ) : (
          <ul className="space-y-3">
            {entries.map((e) => (
              <li key={e.jf_item_id}>
                <Link
                  to="/title/$id"
                  params={{ id: e.jf_item_id }}
                  className="flex items-center gap-3 rounded-xl bg-card/60 p-2 transition-colors hover:bg-accent/60 sm:gap-4 sm:p-3"
                >
                  <img
                    src={`/api/proxy/Items/${e.image_item_id ?? e.jf_item_id}/Images/Primary?maxWidth=200&quality=80`}
                    alt={`${e.title} poster`}
                    loading="lazy"
                    className="h-24 w-16 flex-none rounded-md object-cover sm:h-28 sm:w-20"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{e.title}</p>
                    {e.subtitle && (
                      <p className="truncate text-sm text-muted-foreground">{e.subtitle}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDuration(e.seconds_watched)} watched · {e.play_count} play
                      {e.play_count === 1 ? "" : "s"} · {formatWhen(e.last_played_at)}
                    </p>
                    {e.runtime_seconds ? (
                      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary"
                          style={{
                            width: `${Math.min(100, (e.last_position_seconds / e.runtime_seconds) * 100)}%`,
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
