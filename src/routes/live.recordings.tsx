import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Clapperboard, Play, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { cancelTimerFn, getRecordingsFn, getTimersFn } from "@/lib/livetv.functions";

export const Route = createFileRoute("/live/recordings")({
  head: () => ({
    meta: [
      { title: "Recordings — Aurora" },
      { name: "description", content: "Your recorded live TV and upcoming scheduled recordings." },
      { property: "og:title", content: "Recordings — Aurora" },
      {
        property: "og:description",
        content: "Your recorded live TV and upcoming scheduled recordings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RecordingsPage,
});

function when(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function RecordingsPage() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const cancelTimer = useServerFn(cancelTimerFn);

  const recordings = useQuery({
    queryKey: ["live-recordings"],
    queryFn: () => getRecordingsFn(),
    staleTime: 30_000,
  });
  const timers = useQuery({
    queryKey: ["live-timers"],
    queryFn: () => getTimersFn(),
    staleTime: 0,
  });

  return (
    <div className="space-y-8 px-4 pt-6 sm:px-8">
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">{t("recorded")}</h2>
        {(recordings.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noRecordings")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {recordings.data?.map((r) => (
              <Link
                key={r.id}
                to="/watch/$id"
                params={{ id: r.id }}
                className="group space-y-2 rounded-lg"
              >
                <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-secondary">
                  {r.hasImage ? (
                    <img
                      src={`/api/proxy/Items/${r.id}/Images/Primary?maxWidth=400&quality=85`}
                      alt={r.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <Clapperboard className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <p className="truncate text-sm font-semibold text-foreground">{r.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.subtitle ?? r.channelName ?? ""} · {when(r.start)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">{t("scheduled")}</h2>
        {(timers.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noScheduled")}</p>
        ) : (
          <div className="space-y-2">
            {timers.data?.map((timer) => (
              <div
                key={`${timer.series ? "s" : "t"}-${timer.id}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
              >
                <Play className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {timer.name}
                    {timer.series ? (
                      <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {t("seriesLabel")}
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {timer.channelName ?? ""} {timer.start ? `· ${when(timer.start)}` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t("cancelRecording")}
                  onClick={() => {
                    void cancelTimer({
                      data: { timerId: timer.id, series: timer.series },
                    }).then(() => qc.invalidateQueries({ queryKey: ["live-timers"] }));
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
