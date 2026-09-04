import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Maximize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { getSessionFn } from "@/lib/auth.functions";
import { getItemFn, getPlaybackInfoFn, reportPlayingFn } from "@/lib/jellyfin.functions";
import { episodeLabel } from "@/lib/jellyfin.types";

const itemQuery = (id: string) =>
  queryOptions({ queryKey: ["item", id], queryFn: () => getItemFn({ data: { id } }) });

export const Route = createFileRoute("/watch/$id")({
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (!session) throw redirect({ to: "/login" });
  },
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(itemQuery(params.id)),
  head: ({ loaderData }) => ({
    meta: [
      { title: `Watching ${loaderData?.Name ?? ""} — Aurora` },
      { name: "description", content: loaderData?.Overview ?? "Now playing on Aurora." },
      { property: "og:title", content: `Watching ${loaderData?.Name ?? ""} — Aurora` },
      { property: "og:description", content: loaderData?.Overview ?? "Now playing on Aurora." },
      { property: "og:type", content: "video.other" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WatchPage,
});

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  return h
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

function WatchPage() {
  const { id } = Route.useParams();
  const { data: item } = useSuspenseQuery(itemQuery(id));
  const getPlaybackInfo = useServerFn(getPlaybackInfoFn);
  const reportPlaying = useServerFn(reportPlayingFn);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playSessionRef = useRef("");
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const title = item.SeriesName ? `${item.SeriesName} — ${episodeLabel(item)}` : item.Name;
  const startTicks = item.UserData?.PlaybackPositionTicks ?? 0;

  // Attach stream (HLS via hls.js, direct stream fallback)
  useEffect(() => {
    let cancelled = false;
    let hls: import("hls.js").default | null = null;

    async function setup() {
      const info = await getPlaybackInfo({ data: { itemId: id, startTicks } });
      if (cancelled || !videoRef.current) return;
      playSessionRef.current = info.playSessionId;

      const params = new URLSearchParams({
        mediaSourceId: info.mediaSourceId,
        PlaySessionId: info.playSessionId,
        DeviceId: "aurora-web",
        VideoCodec: "h264",
        AudioCodec: "aac,mp3,ac3",
        MaxStreamingBitrate: "120000000",
        SegmentContainer: "ts",
      });
      if (startTicks) params.set("StartTimeTicks", String(startTicks));
      const hlsUrl = `/api/proxy/Videos/${id}/master.m3u8?${params.toString()}`;
      const directUrl = `/api/proxy/Videos/${id}/stream?static=true&mediaSourceId=${info.mediaSourceId}`;

      const video = videoRef.current;
      const { default: Hls } = await import("hls.js");
      if (cancelled) return;

      if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: true });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal && video && !video.src.includes("/stream")) {
            video.src = directUrl;
            void video.play().catch(() => {});
          }
        });
        hls.loadSource(hlsUrl);
        hls.attachMedia(video);
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = hlsUrl;
      } else {
        video.src = directUrl;
      }
      void video.play().catch(() => {});
    }

    void setup();
    return () => {
      cancelled = true;
      hls?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Progress reporting
  useEffect(() => {
    if (!playing) return;
    void reportPlaying({
      data: {
        itemId: id,
        playSessionId: playSessionRef.current,
        positionTicks: Math.floor(time * 10_000_000),
        kind: "Started",
      },
    });
    const timer = setInterval(() => {
      const v = videoRef.current;
      if (!v) return;
      void reportPlaying({
        data: {
          itemId: id,
          playSessionId: playSessionRef.current,
          positionTicks: Math.floor(v.currentTime * 10_000_000),
          kind: "Progress",
          isPaused: v.paused,
        },
      });
    }, 10_000);
    return () => {
      clearInterval(timer);
      const v = videoRef.current;
      void reportPlaying({
        data: {
          itemId: id,
          playSessionId: playSessionRef.current,
          positionTicks: Math.floor((v?.currentTime ?? time) * 10_000_000),
          kind: "Stopped",
        },
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, playing]);

  function pokeControls() {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3000);
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }

  function seekBy(delta: number) {
    const v = videoRef.current;
    if (v) v.currentTime = Math.max(0, v.currentTime + delta);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void containerRef.current?.requestFullscreen();
  }

  return (
    <div
      ref={containerRef}
      className="relative flex h-screen w-full items-center justify-center bg-black"
      onMouseMove={pokeControls}
      onTouchStart={pokeControls}
    >
      <video
        ref={videoRef}
        className="h-full w-full"
        playsInline
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
      />

      <div
        className={`pointer-events-none absolute inset-0 flex flex-col justify-between transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="pointer-events-auto flex items-center gap-4 bg-gradient-to-b from-black/80 to-transparent p-4 sm:p-6">
          <Link
            to="/title/$id"
            params={{ id: item.SeriesId ?? item.Id }}
            aria-label="Back"
            className="rounded-full p-2 text-foreground transition-colors hover:bg-accent"
          >
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-foreground sm:text-xl">{title}</h1>
            {item.Type === "Episode" && (
              <p className="text-sm text-muted-foreground">{item.Name}</p>
            )}
          </div>
        </div>

        <div className="pointer-events-auto space-y-3 bg-gradient-to-t from-black/80 to-transparent p-4 sm:p-6">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={time}
            onChange={(e) => {
              const v = videoRef.current;
              if (v) v.currentTime = Number(e.target.value);
            }}
            aria-label="Seek"
            className="w-full accent-[var(--color-primary)]"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlay}
                aria-label={playing ? "Pause" : "Play"}
                className="rounded-full p-2 text-foreground transition-colors hover:bg-accent"
              >
                {playing ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current" />}
              </button>
              <button
                onClick={() => seekBy(-10)}
                aria-label="Back 10 seconds"
                className="rounded-full p-2 text-foreground transition-colors hover:bg-accent"
              >
                <RotateCcw className="h-5 w-5" />
              </button>
              <button
                onClick={() => seekBy(10)}
                aria-label="Forward 10 seconds"
                className="rounded-full p-2 text-foreground transition-colors hover:bg-accent"
              >
                <RotateCw className="h-5 w-5" />
              </button>
              <button
                onClick={() => {
                  const v = videoRef.current;
                  if (v) v.muted = !v.muted;
                }}
                aria-label={muted ? "Unmute" : "Mute"}
                className="rounded-full p-2 text-foreground transition-colors hover:bg-accent"
              >
                {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <span className="ml-2 text-xs text-foreground/80">
                {formatTime(time)} / {formatTime(duration)}
              </span>
            </div>
            <button
              onClick={toggleFullscreen}
              aria-label="Fullscreen"
              className="rounded-full p-2 text-foreground transition-colors hover:bg-accent"
            >
              <Maximize className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
