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
import { useEffect, useMemo, useRef, useState } from "react";

import { getSessionFn } from "@/lib/auth.functions";
import {
  getItemFn,
  getPlaybackInfoFn,
  reportPlayingFn,
  setPlayedFn,
} from "@/lib/jellyfin.functions";
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

const posKey = (id: string) => `aurora-pos-${id}`;

function WatchPage() {
  const { id } = Route.useParams();
  const { data: item } = useSuspenseQuery(itemQuery(id));
  const getPlaybackInfo = useServerFn(getPlaybackInfoFn);
  const reportPlaying = useServerFn(reportPlayingFn);
  const setPlayed = useServerFn(setPlayedFn);
  const markedPlayedRef = useRef(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playSessionRef = useRef("");
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [seekFlash, setSeekFlash] = useState<{ dir: -1 | 1; key: number } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapRef = useRef<{ count: number; x: number; timer: ReturnType<typeof setTimeout> | null }>({
    count: 0,
    x: 0,
    timer: null,
  });
  const lastSavedSecond = useRef(-1);

  const isTouch = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches,
    [],
  );

  const title = item.SeriesName ? `${item.SeriesName} — ${episodeLabel(item)}` : item.Name;
  const savedSeconds =
    typeof window !== "undefined" ? Number(localStorage.getItem(posKey(id)) ?? 0) : 0;
  const startTicks = Math.max(
    item.UserData?.PlaybackPositionTicks ?? 0,
    Math.floor(savedSeconds * 10_000_000),
  );

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
        AudioCodec: "aac",
        TranscodingMaxAudioChannels: "2",
        MaxAudioChannels: "2",
        MaxStreamingBitrate: "200000000",
        VideoBitrate: "180000000",
        AudioBitrate: "384000",
        MaxWidth: "3840",
        MaxHeight: "2160",
        h264_profile: "high",
        h264_level: "51",
        SegmentContainer: "ts",
      });

      if (info.audioStreamIndex != null)
        params.set("AudioStreamIndex", String(info.audioStreamIndex));
      if (startTicks) params.set("StartTimeTicks", String(startTicks));

      const hlsUrl = `/api/proxy/Videos/${id}/master.m3u8?${params.toString()}`;
      const directUrl = `/api/proxy/Videos/${id}/stream?static=true&mediaSourceId=${info.mediaSourceId}`;

      const video = videoRef.current;
      // Restore remembered volume/mute
      const vol = localStorage.getItem("aurora-volume");
      const mut = localStorage.getItem("aurora-muted");
      if (vol != null) video.volume = Math.min(1, Math.max(0, Number(vol)));
      if (mut != null) video.muted = mut === "1";

      const { default: Hls } = await import("hls.js");
      if (cancelled) return;

      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          capLevelToPlayerSize: false,
          startLevel: -1,
          maxBufferLength: 60,
          maxMaxBufferLength: 120,
        });

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

  // Unlock orientation when leaving fullscreen
  useEffect(() => {
    function onFsChange() {
      if (!document.fullscreenElement) {
        try {
          screen.orientation?.unlock();
        } catch {
          /* not supported */
        }
      }
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

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
    pokeControls();
  }

  function seekBy(delta: number) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, v.currentTime + delta);
    const flash = { dir: (delta < 0 ? -1 : 1) as -1 | 1, key: Date.now() };
    setSeekFlash(flash);
    setTimeout(() => {
      setSeekFlash((cur) => (cur?.key === flash.key ? null : cur));
    }, 600);
    pokeControls();
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void containerRef.current?.requestFullscreen();
    pokeControls();
  }

  // Fullscreen-first on touch devices: enter fullscreen + landscape when playback starts
  function enterImmersiveMode() {
    if (!isTouch || document.fullscreenElement) return;
    void containerRef.current
      ?.requestFullscreen()
      .then(() => {
        const orientation = screen.orientation as ScreenOrientation & {
          lock?: (o: string) => Promise<void>;
        };
        void orientation.lock?.("landscape").catch(() => {});
      })
      .catch(() => {});
  }

  // Mobile tap handling: single tap = play/pause, double-tap sides = skip 10s
  function handleTouchTap(e: React.TouchEvent<HTMLVideoElement>) {
    e.preventDefault();
    const x = e.changedTouches[0]?.clientX ?? window.innerWidth / 2;
    const t = tapRef.current;
    t.count += 1;
    t.x = x;
    if (t.timer) clearTimeout(t.timer);
    if (t.count >= 2) {
      const third = window.innerWidth / 3;
      if (t.x < third) seekBy(-10);
      else if (t.x > third * 2) seekBy(10);
      else togglePlay();
      t.count = 0;
      t.timer = null;
    } else {
      t.timer = setTimeout(() => {
        togglePlay();
        t.count = 0;
        t.timer = null;
      }, 280);
    }
  }

  function savePosition(seconds: number) {
    const whole = Math.floor(seconds);
    if (whole === lastSavedSecond.current) return;
    lastSavedSecond.current = whole;
    localStorage.setItem(posKey(id), String(seconds));
  }

  return (
    <div
      ref={containerRef}
      className="relative flex h-screen w-full items-center justify-center bg-black"
      onMouseMove={pokeControls}
    >
      <video
        ref={videoRef}
        className="h-full w-full touch-manipulation"
        playsInline
        onClick={isTouch ? undefined : togglePlay}
        onTouchEnd={isTouch ? handleTouchTap : undefined}
        onPlay={() => {
          setPlaying(true);
          enterImmersiveMode();
        }}
        onPause={(e) => {
          setPlaying(false);
          savePosition(e.currentTarget.currentTime);
          void reportPlaying({
            data: {
              itemId: id,
              playSessionId: playSessionRef.current,
              positionTicks: Math.floor(e.currentTarget.currentTime * 10_000_000),
              kind: "Progress",
              isPaused: true,
            },
          });
        }}
        onSeeked={(e) => {
          savePosition(e.currentTarget.currentTime);
          void reportPlaying({
            data: {
              itemId: id,
              playSessionId: playSessionRef.current,
              positionTicks: Math.floor(e.currentTarget.currentTime * 10_000_000),
              kind: "Progress",
              isPaused: e.currentTarget.paused,
            },
          });
        }}
        onEnded={(e) => {
          localStorage.removeItem(posKey(id));
          void reportPlaying({
            data: {
              itemId: id,
              playSessionId: playSessionRef.current,
              positionTicks: Math.floor(e.currentTarget.currentTime * 10_000_000),
              kind: "Stopped",
            },
          });
          if (!markedPlayedRef.current) {
            markedPlayedRef.current = true;
            void setPlayed({ data: { itemId: id, played: true } });
          }
        }}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          setTime(v.currentTime);
          if (Math.floor(v.currentTime) % 5 === 0) savePosition(v.currentTime);
          if (
            !markedPlayedRef.current &&
            v.duration > 0 &&
            v.currentTime / v.duration >= 0.95
          ) {
            markedPlayedRef.current = true;
            localStorage.removeItem(posKey(id));
            void setPlayed({ data: { itemId: id, played: true } });
          }
        }}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onVolumeChange={(e) => {
          setMuted(e.currentTarget.muted);
          localStorage.setItem("aurora-muted", e.currentTarget.muted ? "1" : "0");
          localStorage.setItem("aurora-volume", String(e.currentTarget.volume));
        }}
      />

      {/* Skip flash indicator */}
      {seekFlash && (
        <div
          key={seekFlash.key}
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 ${
            seekFlash.dir < 0 ? "left-10" : "right-10"
          }`}
        >
          <div className="flex animate-pulse flex-col items-center rounded-full bg-black/60 p-4 text-foreground">
            {seekFlash.dir < 0 ? (
              <RotateCcw className="h-8 w-8" />
            ) : (
              <RotateCw className="h-8 w-8" />
            )}
            <span className="text-xs font-bold">10s</span>
          </div>
        </div>
      )}

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

        {/* Big center controls (mobile-first) */}
        <div
          className={`pointer-events-auto flex items-center justify-center gap-10 sm:gap-16 ${
            showControls ? "" : "pointer-events-none"
          }`}
        >
          <button
            onClick={() => seekBy(-10)}
            aria-label="Back 10 seconds"
            className="flex flex-col items-center gap-1 rounded-full p-3 text-foreground transition-transform active:scale-90"
          >
            <RotateCcw className="h-9 w-9 sm:h-10 sm:w-10" />
            <span className="text-[10px] font-bold">10</span>
          </button>
          <button
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
            className="rounded-full bg-foreground/15 p-5 text-foreground backdrop-blur-sm transition-transform active:scale-90 sm:p-6"
          >
            {playing ? (
              <Pause className="h-10 w-10 fill-current sm:h-12 sm:w-12" />
            ) : (
              <Play className="h-10 w-10 fill-current sm:h-12 sm:w-12" />
            )}
          </button>
          <button
            onClick={() => seekBy(10)}
            aria-label="Forward 10 seconds"
            className="flex flex-col items-center gap-1 rounded-full p-3 text-foreground transition-transform active:scale-90"
          >
            <RotateCw className="h-9 w-9 sm:h-10 sm:w-10" />
            <span className="text-[10px] font-bold">10</span>
          </button>
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
