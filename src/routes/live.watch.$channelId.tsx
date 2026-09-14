import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Maximize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { getSessionFn } from "@/lib/auth.functions";
import { useLanguage } from "@/lib/i18n";
import { getPlaybackInfoFn, stopTranscodeFn } from "@/lib/jellyfin.functions";
import { getLiveChannelFn } from "@/lib/livetv.functions";

export const Route = createFileRoute("/live/watch/$channelId")({
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (!session) throw redirect({ to: "/login" });
  },
  head: () => ({
    meta: [
      { title: "Live channel — Aurora" },
      { name: "description", content: "Watching live TV on Aurora." },
      { property: "og:title", content: "Live channel — Aurora" },
      { property: "og:description", content: "Watching live TV on Aurora." },
      { property: "og:type", content: "video.other" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LiveWatchPage,
});

function LiveWatchPage() {
  const { t } = useLanguage();
  const { channelId } = Route.useParams();
  const getPlaybackInfo = useServerFn(getPlaybackInfoFn);
  const stopTranscode = useServerFn(stopTranscodeFn);

  const channel = useQuery({
    queryKey: ["live-channel", channelId],
    queryFn: () => getLiveChannelFn({ data: { channelId } }),
    staleTime: 60_000,
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playSessionRef = useRef("");
  const deviceIdRef = useRef("");
  if (!deviceIdRef.current) {
    let stored = typeof localStorage !== "undefined" ? localStorage.getItem("aurora-device-id") : null;
    if (!stored) {
      stored = `aurora-web-${Math.random().toString(36).slice(2, 10)}`;
      if (typeof localStorage !== "undefined") localStorage.setItem("aurora-device-id", stored);
    }
    deviceIdRef.current = stored;
  }

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingPercent, setLoadingPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const retryRef = useRef<(() => void) | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pokeControls = () => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 5000);
  };

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let hls: import("hls.js").default | null = null;
    // Never leave the loading screen up forever: reveal the player once the
    // channel has had enough time to negotiate a stream.
    const safety = setTimeout(() => {
      if (cancelled) return;
      setLoadingPercent(100);
      setLoading(false);
      void videoRef.current?.play().catch(() => {});
    }, 25_000);


    async function setup() {
      setError(null);
      setLoading(true);
      setLoadingPercent(0);
      const deviceId = deviceIdRef.current;
      let info: Awaited<ReturnType<typeof getPlaybackInfo>>;
      setLoadingPercent(20);
      try {
        info = await getPlaybackInfo({ data: { itemId: channelId, deviceId } });
      } catch {
        if (!cancelled) setError(t("streamFailed"));
        return;
      }
      if (cancelled || !videoRef.current) return;
      setLoadingPercent(35);
      playSessionRef.current = info.playSessionId;
      const video = videoRef.current;

      const params = new URLSearchParams({
        mediaSourceId: info.mediaSourceId,
        PlaySessionId: info.playSessionId,
        DeviceId: deviceId,
        VideoCodec: "h264",
        AudioCodec: "aac",
        MaxAudioChannels: "2",
        TranscodingMaxAudioChannels: "2",
        SegmentContainer: "ts",
        SubtitleStreamIndex: "-1",
        SubtitleMethod: "External",
      });
      const hlsUrl = info.transcodingUrl
        ? `/api/proxy${info.transcodingUrl}`
        : `/api/proxy/Videos/${channelId}/master.m3u8?${params.toString()}`;

      const { default: Hls } = await import("hls.js");
      if (cancelled) return;

      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          liveSyncDurationCount: 4,
          maxBufferLength: 30,
          manifestLoadingTimeOut: 30_000,
          manifestLoadingMaxRetry: 6,
          levelLoadingTimeOut: 30_000,
          levelLoadingMaxRetry: 8,
          fragLoadingTimeOut: 90_000,
          fragLoadingMaxRetry: 10,
        });
        let networkRecoveries = 0;
        let mediaRecoveries = 0;
        retryRef.current = () => {
          setError(null);
          hls?.stopLoad();
          hls?.loadSource(hlsUrl);
          hls?.startLoad(-1);
          void video.play().catch(() => {});
        };
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal || !hls) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRecoveries < 6) {
            networkRecoveries += 1;
            hls.startLoad();
            return;
          }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries < 4) {
            mediaRecoveries += 1;
            hls.recoverMediaError();
            return;
          }
          hls.stopLoad();
          setError(t("streamInterrupted"));
        });
        hls.on(Hls.Events.MEDIA_ATTACHED, () => hls?.loadSource(hlsUrl));
        hls.on(Hls.Events.LEVEL_LOADED, () => setLoadingPercent((p) => Math.max(p, 50)));
        hls.on(Hls.Events.FRAG_BUFFERED, () => setLoadingPercent((p) => Math.min(95, p + 10)));
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setLoadingPercent((p) => Math.max(p, 50));
          void video.play().catch(() => {
            video.muted = true;
            void video.play().catch(() => {});
          });
        });
        video.addEventListener("canplay", () => setLoadingPercent((p) => Math.max(p, 90)), {
          once: true,
        });
        hls.attachMedia(video);
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = hlsUrl;
        retryRef.current = () => {
          setError(null);
          video.src = hlsUrl;
          video.load();
          void video.play().catch(() => {});
        };
        video.addEventListener("canplay", () => setLoadingPercent((p) => Math.max(p, 90)), {
          once: true,
        });
        setLoadingPercent(60);
        video.load();
        void video.play().catch(() => {});
      } else {
        setError(t("streamFailed"));
      }
    }

    void setup();
    return () => {
      cancelled = true;
      clearTimeout(safety);
      retryRef.current = null;
      const sid = playSessionRef.current;
      try {
        hls?.destroy();
      } catch {
        /* already gone */
      }
      hls = null;
      const v = videoRef.current;
      if (v) {
        try {
          v.pause();
          v.removeAttribute("src");
          v.load();
        } catch {
          /* ignore */
        }
      }
      if (sid) {
        void stopTranscode({ data: { playSessionId: sid, deviceId: deviceIdRef.current } });
        playSessionRef.current = "";
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
    pokeControls();
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => {});
  };

  return (
    <div
      ref={containerRef}
      className="relative h-screen w-screen bg-black"
      onMouseMove={pokeControls}
      onTouchStart={pokeControls}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " " || e.key === "MediaPlayPause") togglePlay();
        else pokeControls();
      }}
      tabIndex={0}
    >
      <video
        ref={videoRef}
        className="h-full w-full touch-manipulation"
        playsInline
        autoPlay
        onClick={togglePlay}
        onCanPlay={(e) => {
          setLoadingPercent(100);
          setLoading(false);
          pokeControls();
          const v = e.currentTarget;
          if (v.paused) {
            v.play().catch(() => {
              v.muted = true;
              void v.play().catch(() => {});
            });
          }
        }}
        onPlay={() => {
          setPlaying(true);
          setLoadingPercent(100);
          setLoading(false);
          pokeControls();
        }}
        onPause={() => setPlaying(false)}
        onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
      />

      {loading && !error && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black">
          {channel.data?.hasImage ? (
            <div
              className="absolute inset-0 bg-contain bg-center bg-no-repeat opacity-30"
              style={{
                backgroundImage: `url('/api/proxy/Items/${channelId}/Images/Primary?fillHeight=720&fillWidth=1280&quality=80')`,
              }}
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30" />
          <div className="relative z-10 flex w-full max-w-xs flex-col items-center px-6 text-center">
            <h2 className="mb-1 text-lg font-semibold text-foreground line-clamp-2">
              {channel.data?.name ?? t("liveTv")}
            </h2>
            <p className="mb-8 text-sm text-muted-foreground">{t("loadingStream")}</p>
            <div className="text-5xl font-bold tabular-nums text-foreground">{loadingPercent}%</div>
            <div className="mt-8 h-1 w-full overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full bg-primary transition-[width] duration-300 ease-out"
                style={{ width: `${loadingPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-background/90 px-6 text-center">
          <p className="max-w-md text-sm text-foreground">{error}</p>
          <Button type="button" size="lg" onClick={() => retryRef.current?.()}>
            {t("retryPlayback")}
          </Button>
        </div>
      )}

      <div
        className={`pointer-events-none absolute inset-0 flex flex-col justify-between transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="pointer-events-auto flex items-center gap-4 bg-gradient-to-b from-black/80 to-transparent p-4 sm:p-6">
          <Link
            to="/live"
            aria-label={t("back")}
            className="rounded-full p-2 text-foreground transition-colors hover:bg-accent"
          >
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-foreground sm:text-xl">
              {channel.data?.name ?? t("liveTv")}
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              <span className="mr-2 rounded bg-primary px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary-foreground">
                {t("liveBadge")}
              </span>
              {channel.data?.now?.name ?? ""}
            </p>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center justify-center">
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
        </div>

        <div className="pointer-events-auto flex items-center gap-2 bg-gradient-to-t from-black/80 to-transparent p-4 sm:p-6">
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
          <button
            onClick={toggleFullscreen}
            aria-label="Fullscreen"
            className="ml-auto rounded-full p-2 text-foreground transition-colors hover:bg-accent"
          >
            <Maximize className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
