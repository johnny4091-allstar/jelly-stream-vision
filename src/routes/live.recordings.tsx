import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, ChevronLeft, ChevronRight, Clapperboard, List, Play, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

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

function clock(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function dayKey(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function keyOf(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function RecordingsPage() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const cancelTimer = useServerFn(cancelTimerFn);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState(() => keyOf(new Date()));

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

  type Entry = {
    id: string;
    kind: "recorded" | "scheduled";
    name: string;
    sub: string | null;
    start: string | null;
    series: boolean;
    hasImage: boolean;
  };

  const entries = useMemo<Entry[]>(
    () => [
      ...(recordings.data ?? []).map((r) => ({
        id: r.id,
        kind: "recorded" as const,
        name: r.name,
        sub: r.subtitle ?? r.channelName,
        start: r.start,
        series: false,
        hasImage: r.hasImage,
      })),
      ...(timers.data ?? []).map((timer) => ({
        id: timer.id,
        kind: "scheduled" as const,
        name: timer.name,
        sub: timer.channelName,
        start: timer.start,
        series: timer.series,
        hasImage: false,
      })),
    ],
    [recordings.data, timers.data],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of entries) {
      const k = dayKey(e.start);
      if (!k) continue;
      const list = map.get(k) ?? [];
      list.push(e);
      map.set(k, list);
    }
    for (const list of map.values())
      list.sort((a, b) => new Date(a.start ?? 0).getTime() - new Date(b.start ?? 0).getTime());
    return map;
  }, [entries]);

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const startPad = first.getDay();
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const out: (Date | null)[] = [];
    for (let i = 0; i < startPad; i++) out.push(null);
    for (let d = 1; d <= days; d++) out.push(new Date(month.getFullYear(), month.getMonth(), d));
    return out;
  }, [month]);

  const todayKey = keyOf(new Date());
  const dayEntries = byDay.get(selectedDay) ?? [];

  return (
    <div className="space-y-8 px-4 pt-6 sm:px-8">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={view === "list" ? "default" : "secondary"}
          className="rounded-full"
          onClick={() => setView("list")}
        >
          <List className="mr-1 h-4 w-4" /> {t("listView")}
        </Button>
        <Button
          size="sm"
          variant={view === "calendar" ? "default" : "secondary"}
          className="rounded-full"
          onClick={() => setView("calendar")}
        >
          <CalendarDays className="mr-1 h-4 w-4" /> {t("calendarView")}
        </Button>
      </div>

      {view === "calendar" ? (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="secondary"
              className="rounded-full"
              onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="text-sm font-bold text-foreground">
              {month.toLocaleDateString([], { month: "long", year: "numeric" })}
            </p>
            <Button
              size="icon"
              variant="secondary"
              className="rounded-full"
              onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={`${d}-${i}`}>{d}</div>
            ))}
            {cells.map((date, i) => {
              if (!date) return <div key={`pad-${i}`} />;
              const k = keyOf(date);
              const count = byDay.get(k)?.length ?? 0;
              const selected = k === selectedDay;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSelectedDay(k)}
                  className={`flex aspect-square flex-col items-center justify-center rounded-lg border text-sm transition-colors ${
                    selected
                      ? "border-primary bg-primary/20 text-foreground"
                      : k === todayKey
                        ? "border-primary/40 text-foreground"
                        : "border-transparent bg-card text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {date.getDate()}
                  {count > 0 && <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            {dayEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noScheduled")}</p>
            ) : (
              dayEntries.map((e) => (
                <div
                  key={`${e.kind}-${e.id}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <span className="w-16 shrink-0 text-xs tabular-nums text-muted-foreground">
                    {clock(e.start)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{e.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {e.sub ?? ""} ·{" "}
                      {e.kind === "recorded" ? t("recorded") : t("scheduled")}
                    </p>
                  </div>
                  {e.kind === "recorded" ? (
                    <Button asChild size="icon" className="h-8 w-8 rounded-full">
                      <Link to="/watch/$id" params={{ id: e.id }} aria-label={t("play")}>
                        <Play className="h-4 w-4 fill-current" />
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label={t("cancelRecording")}
                      onClick={() => {
                        void cancelTimer({ data: { timerId: e.id, series: e.series } }).then(() =>
                          qc.invalidateQueries({ queryKey: ["live-timers"] }),
                        );
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      ) : (
        <>
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
                    <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-secondary">
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
                      <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <Play className="h-10 w-10 fill-current text-primary" />
                      </span>
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
        </>
      )}
    </div>
  );
}
