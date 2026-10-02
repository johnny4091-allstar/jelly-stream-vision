import { RouteError } from "@/components/RouteError";
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
  Languages,
  Captions,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { getSessionFn } from "@/lib/auth.functions";
import { logWatchFn } from "@/lib/history.functions";
import {
  getPlayableItemFn,
  getPlaybackInfoFn,
  reportPlayingFn,
  stopTranscodeFn,
  setPlayedFn,
} from "@/lib/jellyfin.functions";
import { episodeLabel } from "@/lib/jellyfin.types";
import { audioLanguageCodes, LanguageSelect, useLanguage } from "@/lib/i18n";

const itemQuery = (id: string) =>
  queryOptions({ queryKey: ["playable-item", id], queryFn: () => getPlayableItemFn({ data: { id } }) });

export const Route = createFileRoute("/watch/$id")({
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (!session) throw redirect({ to: "/login" });
  },
  loader: async ({ context, params }) => {
    return context.queryClient.ensureQueryData(itemQuery(params.id));
  },
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
  errorComponent: RouteError,
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

function languageName(code: string | null) {
  if (!code) return null;
  try {
    return new Intl.DisplayNames([navigator.language || "en"], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

const posKey = (id: string) => `aurora-pos-${id}`;

function WatchPage() {
  const { language, t } = useLanguage();
  const { id } = Route.useParams();
  const { data: item } = useSuspenseQuery(itemQuery(id));
  const getPlaybackInfo = useServerFn(getPlaybackInfoFn);
  const reportPlaying = useServerFn(reportPlayingFn);
  const logWatch = useServerFn(logWatchFn);
  const stopTranscode = useServerFn(stopTranscodeFn);
  const setPlayed = useServerFn(setPlayedFn);
  const markedPlayedRef = useRef(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playSessionRef = useRef("");
  // One stable device id per browser: Jellyfin then reuses (and replaces) the same
  // playback session instead of leaving an orphaned transcode behind on every visit.
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
  const [volume, setVolume] = useState(1);
  const [buffered, setBuffered] = useState(0);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [audioTracks, setAudioTracks] = useState<
    { index: number; language: string | null; label: string; codec: string | null; channels: number | null }[]
  >([]);
  const [audioIndex, setAudioIndex] = useState<number | null>(null);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [subtitleTracks, setSubtitleTracks] = useState<
    { index: number; language: string | null; label: string }[]
  >([]);
  const [subtitleIndex, setSubtitleIndex] = useState<number | null>(null);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [mediaSourceId, setMediaSourceId] = useState("");
  const [playMode, setPlayMode] = useState<"DirectPlay" | "DirectStream" | "Transcode" | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPercent, setLoadingPercent] = useState(0);
  const playMethodRef = useRef<"DirectPlay" | "DirectStream" | "Transcode">("Transcode");
  const mediaSourceIdRef = useRef("");

  const retryPlaybackRef = useRef<(() => void) | null>(null);
  // Fresh-session recovery: bumping the nonce renegotiates playback from scratch.
  const [sessionNonce, setSessionNonce] = useState(0);
  const resumeOverrideRef = useRef<number | null>(null);
  const autoRetriedRef = useRef(false);
  const playingRef = useRef(false);
  const startedRef = useRef(false);
  const historyLogRef = useRef<((isNewPlay?: boolean) => void) | null>(null);
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

  useEffect(() => {
    if (audioIndex != null || audioTracks.length < 2) return;
    const codes = audioLanguageCodes[language];
    const preferred = audioTracks.find((track) =>
      track.language ? codes.includes(track.language.toLowerCase()) : false,
    );
    if (preferred) setAudioIndex(preferred.index);
  }, [audioIndex, audioTracks, language]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    for (let index = 0; index < video.textTracks.length; index += 1) {
      const track = video.textTracks[index];
      if (track) track.mode = subtitleIndex === subtitleTracks[index]?.index ? "showing" : "disabled";
    }
  }, [subtitleIndex, subtitleTracks]);

  const title = item.SeriesName ? `${item.SeriesName} — ${episodeLabel(item)}` : item.Name;
  // Old links can contain a truncated Jellyfin ID. getItemFn resolves those,
  // and every playback request must use the canonical ID returned by Jellyfin.
  const playbackId = item.Id;
  const savedSeconds =
    typeof window !== "undefined" ? Number(localStorage.getItem(posKey(playbackId)) ?? 0) : 0;
  const startTicks = Math.max(
    item.UserData?.PlaybackPositionTicks ?? 0,
    Math.floor(savedSeconds * 10_000_000),
  );

  /** Drop the current server session and negotiate a fresh one at the current position. */
  const renegotiate = () => {
    const v = videoRef.current;
    if (v && Number.isFinite(v.currentTime) && v.currentTime > 0) {
      resumeOverrideRef.current = Math.floor(v.currentTime * 10_000_000);
    }
    setPlaybackError(null);
    setSessionNonce((n) => n + 1);
  };

  /** Stopped is only sent on exit, end of title, or session replacement — never on pause. */
  const sendStopped = () => {
    if (!startedRef.current) return;
    startedRef.current = false;
    const v = videoRef.current;
    void reportPlaying({
      data: {
        itemId: playbackId,
        playSessionId: playSessionRef.current,
        deviceId: deviceIdRef.current,
        positionTicks: Math.floor((v?.currentTime ?? 0) * 10_000_000),
        kind: "Stopped",
        mediaSourceId: mediaSourceIdRef.current,
        playMethod: playMethodRef.current,
      },
    }).catch(() => {});
  };

  // Play the original file (MKV/MP4/MOV/TS/WebM) when this device can decode it,
  // otherwise fall back to Jellyfin's converted HLS stream. Never fall back to a
  // raw file the browser cannot decode.
  useEffect(() => {
    let cancelled = false;
    let hls: import("hls.js").default | null = null;
    let networkRecoveries = 0;
    let mediaRecoveries = 0;
    const effectiveStartTicks = resumeOverrideRef.current ?? startTicks;
    resumeOverrideRef.current = null;
    const failOrRetry = (message: string) => {
      if (cancelled) return;
      if (!autoRetriedRef.current) {
        autoRetriedRef.current = true;
        renegotiate();
        return;
      }
      setPlaybackError(message);
    };
    // After ~30s of healthy playback, forget earlier transient blips.
    let lastT = -1;
    let healthySeconds = 0;
    const healthTimer = setInterval(() => {
      const v = videoRef.current;
      if (!v || v.paused) return;
      if (v.currentTime > lastT + 1) {
        healthySeconds += 5;
        if (healthySeconds >= 30) {
          networkRecoveries = 0;
          mediaRecoveries = 0;
          autoRetriedRef.current = false;
        }
      } else {
        healthySeconds = 0;
      }
      lastT = v.currentTime;
    }, 5_000);
    const onVideoError = () => {
      if (hls) return; // hls.js reports its own errors
      failOrRetry("The stream was interrupted. Tap retry to continue.");
    };
    // Never leave the loading screen up forever: reveal the player and its
    // play button if the stream hasn't announced itself in time.
    const bailout = setTimeout(() => {
      if (!cancelled) {
        setLoading(false);
        setShowControls(true);
      }
    }, 25_000);

    async function setup() {
      setPlaybackError(null);
      setLoading(true);
      setLoadingPercent(0);
      retryPlaybackRef.current = renegotiate;
      const deviceId = deviceIdRef.current;
      const { detectDirectPlayProfiles } = await import("@/lib/media-capabilities");
      const capabilities = detectDirectPlayProfiles();
      if (cancelled) return;
      let info: Awaited<ReturnType<typeof getPlaybackInfo>>;
      try {
        info = await getPlaybackInfo({
          data: {
            itemId: playbackId,
            startTicks: effectiveStartTicks,
            deviceId,
            capabilities,
            ...(audioIndex != null ? { audioStreamIndex: audioIndex } : {}),
          },
        });
      } catch {
        failOrRetry("The stream could not be started. Tap retry.");
        return;
      }
      if (cancelled || !videoRef.current) return;
      setLoadingPercent(20);
      playSessionRef.current = info.playSessionId;
      setMediaSourceId(info.mediaSourceId);
      mediaSourceIdRef.current = info.mediaSourceId;
      setAudioTracks(info.audioTracks ?? []);
      setSubtitleTracks(info.subtitleTracks ?? []);
      playMethodRef.current = info.playMethod;
      setPlayMode(info.playMethod);

      const params = new URLSearchParams({
        mediaSourceId: info.mediaSourceId,
        PlaySessionId: info.playSessionId,
        DeviceId: deviceId,
        VideoCodec: "h264",
        AudioCodec: "aac",
        TranscodingMaxAudioChannels: "2",
        MaxAudioChannels: "2",
        // Sane ceilings: asking for 200 Mbps made the server transcode far
        // slower than real time, which is why playback stalled after ~90s.
        MaxStreamingBitrate: "8000000",
        VideoBitrate: "6500000",
        AudioBitrate: "192000",
        MaxWidth: "1920",
        MaxHeight: "1080",
        h264_profile: "high",
        h264_level: "41",
        SegmentContainer: "ts",
      });

      if (info.audioStreamIndex != null)
        params.set("AudioStreamIndex", String(info.audioStreamIndex));
      // Prefer the exact transcode URL Jellyfin negotiated for this item;
      // it already has the right stream indexes for TV episodes (mkv/HEVC).
      const hlsUrl = info.transcodingUrl
        ? (() => {
            const negotiated = new URL(info.transcodingUrl, window.location.origin);
            negotiated.searchParams.set("MaxWidth", "1920");
            negotiated.searchParams.set("MaxHeight", "1080");
            // A default ASS/PGS subtitle made the server burn every frame, which
            // fails the encoder outright. External keeps subtitles out of ffmpeg.
            negotiated.searchParams.set("SubtitleStreamIndex", "-1");
            negotiated.searchParams.set("SubtitleMethod", "External");
            // Force browser-playable stereo AAC: Jellyfin often negotiates a
            // copy of EAC3/DTS/TrueHD, which plays video but produces no sound.
            negotiated.searchParams.set("AudioCodec", "aac");
            negotiated.searchParams.set("TranscodingMaxAudioChannels", "2");
            negotiated.searchParams.set("MaxAudioChannels", "2");
            negotiated.searchParams.set("AudioBitrate", "192000");
            negotiated.searchParams.delete("AudioStreamIndexCopy");
            if (info.audioStreamIndex != null)
              negotiated.searchParams.set("AudioStreamIndex", String(info.audioStreamIndex));
            negotiated.searchParams.delete("BreakOnNonKeyFrames");
            return `/api/proxy${negotiated.pathname}${negotiated.search}`;
          })()
        : `/api/proxy/Videos/${playbackId}/master.m3u8?${params.toString()}`;
      const directParams = new URLSearchParams({
        static: "true",
        mediaSourceId: info.mediaSourceId,
        PlaySessionId: info.playSessionId,
        DeviceId: deviceId,
      });
      const directUrl = `/api/proxy/Videos/${playbackId}/stream?${directParams.toString()}`;
      const video = videoRef.current;
      const resumeSeconds = effectiveStartTicks / 10_000_000;
      video.addEventListener("error", onVideoError);
      let resumeApplied = false;
      const applyResumePosition = () => {
        if (resumeApplied || !Number.isFinite(resumeSeconds) || resumeSeconds <= 0) return;
        resumeApplied = true;
        video.currentTime = resumeSeconds;
      };
      // Restore remembered volume/mute
      const vol = localStorage.getItem("aurora-volume");
      const mut = localStorage.getItem("aurora-muted");
      if (vol != null) video.volume = Math.min(1, Math.max(0, Number(vol)));
      if (mut != null) video.muted = mut === "1";

      const attachDirect = () => {
        setLoadingPercent(35);
        video.src = directUrl;
        video.addEventListener("loadedmetadata", () => {
          applyResumePosition();
          setLoadingPercent(70);
        }, { once: true });
        video.addEventListener("canplay", () => setLoadingPercent(90), { once: true });
        video.load();
      };

      // Original file plays untouched — best quality, no server load.
      // A hand-picked language needs the server to remux/transcode that track:
      // the browser cannot switch audio tracks inside a direct-played file.
      if (info.playMethod === "DirectPlay" && audioIndex == null) {
        attachDirect();
        void video.play().catch(() => {});
        return;
      }

      const { default: Hls } = await import("hls.js");
      if (cancelled) return;

      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          startLevel: -1,
          capLevelToPlayerSize: false,
          abrEwmaDefaultEstimate: 10_000_000,
          abrBandWidthFactor: 0.9,
          abrBandWidthUpFactor: 0.7,
          maxBufferLength: 60,
          maxMaxBufferLength: 120,
          backBufferLength: 30,
          maxBufferHole: 1,
          // Long transcode start-up through the proxy needs patient timeouts + retries.
          manifestLoadingTimeOut: 30_000,
          manifestLoadingMaxRetry: 6,
          levelLoadingTimeOut: 30_000,
          levelLoadingMaxRetry: 8,
          fragLoadingTimeOut: 90_000,
          fragLoadingMaxRetry: 10,
          fragLoadingMaxRetryTimeout: 8_000,
          nudgeMaxRetry: 10,
        });

        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          const h = hls;
          if (!h || !video) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRecoveries < 6) {
            networkRecoveries += 1;
            h.startLoad();
            return;
          }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries < 4) {
            mediaRecoveries += 1;
            h.recoverMediaError();
            return;
          }
          h.stopLoad();
          failOrRetry("The stream was interrupted. Tap retry to continue.");
        });

        // Keep playback moving if the buffer stalls mid-segment.
        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          video.addEventListener("waiting", () => {
            if (hls && video.readyState < 3) hls.startLoad(-1);
          });
        });

        hls.on(Hls.Events.MEDIA_ATTACHED, () => hls?.loadSource(hlsUrl));
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setLoadingPercent(50);
          applyResumePosition();
          void video.play().catch(() => {});
        });
        hls.on(Hls.Events.FRAG_BUFFERED, () => setLoadingPercent((p) => Math.min(95, p + 10)));
        hls.on(Hls.Events.LEVEL_LOADED, () => setLoadingPercent(40));
        video.addEventListener("canplay", () => setLoadingPercent(90), { once: true });
        hls.attachMedia(video);
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        setLoadingPercent(35);
        video.src = hlsUrl;
        video.addEventListener("loadedmetadata", () => {
          applyResumePosition();
          setLoadingPercent(70);
        }, { once: true });
        video.addEventListener("canplay", () => setLoadingPercent(90), { once: true });
      } else if (info.supportsDirectStream) {
        playMethodRef.current = "DirectStream";
        setPlayMode("DirectStream");
        attachDirect();
      } else {
        setPlaybackError("This device cannot play the compatible stream.");
        return;
      }
      void video.play().catch(() => {});

    }


    void setup();
    return () => {
      cancelled = true;
      clearTimeout(bailout);
      clearInterval(healthTimer);
      retryPlaybackRef.current = null;
      // Session is being replaced or the viewer left: close it on the server.
      sendStopped();
      const sid = playSessionRef.current;
      const v = videoRef.current;
      v?.removeEventListener("error", onVideoError);
      try {
        hls?.destroy();
      } catch {
        /* already gone */
      }
      hls = null;
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
  }, [playbackId, audioIndex, sessionNonce]);


  // Progress reporting: Progress on an interval only. Started is sent on first
  // play (onPlay) and Stopped only on exit/end/session replacement (sendStopped).
  useEffect(() => {
    const timer = setInterval(() => {
      const v = videoRef.current;
      if (!v || !startedRef.current) return;
      void reportPlaying({
        data: {
          itemId: playbackId,
          playSessionId: playSessionRef.current,
          deviceId: deviceIdRef.current,
          positionTicks: Math.floor(v.currentTime * 10_000_000),
          kind: "Progress",
          mediaSourceId: mediaSourceIdRef.current,
          playMethod: playMethodRef.current,
          isPaused: v.paused,
        },
      }).catch(() => {});
    }, 10_000);
    // Watch history: only time actually spent playing accumulates.
    const histTitle = item.SeriesName ?? item.Name ?? "Unknown";
    const histSubtitle = item.SeriesName ? (item.Name ?? null) : null;
    const runtimeFallback = item.RunTimeTicks ? item.RunTimeTicks / 10_000_000 : null;
    let playedSeconds = 0;
    let loggedNewPlay = false;
    const playTick = setInterval(() => {
      const v = videoRef.current;
      if (v && playingRef.current && !v.paused) playedSeconds += 1;
    }, 1_000);
    const logDelta = (isNewPlay = false) => {
      const newPlay = isNewPlay && !loggedNewPlay;
      if (!loggedNewPlay && !newPlay) return; // nothing played yet
      loggedNewPlay = true;
      const delta = Math.min(playedSeconds, 120);
      playedSeconds = 0;
      if (!delta && !newPlay) return;
      const v = videoRef.current;
      void logWatch({
        data: {
          itemId: playbackId,
          title: histTitle,
          subtitle: histSubtitle,
          itemType: item.Type ?? "Movie",
          imageItemId: item.SeriesId ?? item.Id,
          secondsDelta: delta,
          positionSeconds: v?.currentTime ?? 0,
          runtimeSeconds:
            v?.duration && Number.isFinite(v.duration) ? v.duration : runtimeFallback,
          isNewPlay: newPlay,
        },
      }).catch(() => {});
    };
    historyLogRef.current = logDelta;
    const histTimer = setInterval(() => logDelta(), 30_000);
    return () => {
      clearInterval(timer);
      clearInterval(playTick);
      clearInterval(histTimer);
      logDelta();
      historyLogRef.current = null;
      sendStopped();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbackId]);

  // Closing the tab or backgrounding the phone must also kill the server-side transcode.
  useEffect(() => {
    const teardown = () => {
      const v = videoRef.current;
      const sid = playSessionRef.current;
      void reportPlaying({
        data: {
          itemId: playbackId,
          playSessionId: sid,
          deviceId: deviceIdRef.current,
          positionTicks: Math.floor((v?.currentTime ?? 0) * 10_000_000),
          kind: "Stopped",
          mediaSourceId: mediaSourceIdRef.current,
          playMethod: playMethodRef.current,
        },
      });
      if (sid) void stopTranscode({ data: { playSessionId: sid, deviceId: deviceIdRef.current } });
    };
    window.addEventListener("pagehide", teardown);
    return () => window.removeEventListener("pagehide", teardown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbackId]);

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
    hideTimer.current = setTimeout(() => setShowControls(false), 5000);
  }

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

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

  // Fullscreen-first: enter fullscreen (and landscape on phones) when playback starts
  function enterImmersiveMode() {
    if (document.fullscreenElement) return;
    void containerRef.current
      ?.requestFullscreen()
      .then(() => {
        if (!isTouch) return;
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

  // TV remote / keyboard control: OK plays-pauses, left/right skip 10s, back exits.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      switch (e.key) {
        case "Enter":
        case " ":
        case "MediaPlayPause":
          e.preventDefault();
          togglePlay();
          break;
        case "MediaPlay":
          e.preventDefault();
          void videoRef.current?.play();
          pokeControls();
          break;
        case "MediaPause":
          e.preventDefault();
          videoRef.current?.pause();
          pokeControls();
          break;
        case "ArrowRight":
        case "MediaFastForward":
          e.preventDefault();
          seekBy(10);
          break;
        case "ArrowLeft":
        case "MediaRewind":
          e.preventDefault();
          seekBy(-10);
          break;
        case "ArrowUp":
        case "ArrowDown":
          pokeControls();
          break;
        case "Escape":
        case "Backspace":
        case "GoBack":
          if (document.fullscreenElement) {
            e.preventDefault();
            void document.exitFullscreen();
          } else {
            window.history.back();
          }
          break;
        default:
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function savePosition(seconds: number) {
    const whole = Math.floor(seconds);
    if (whole === lastSavedSecond.current) return;
    lastSavedSecond.current = whole;
    localStorage.setItem(posKey(playbackId), String(seconds));
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
        onCanPlay={(e) => {
          // Loading hit 100% — drop the loading screen and try to autoplay.
          setLoadingPercent(100);
          setLoading(false);
          pokeControls();
          const v = e.currentTarget;
          if (v.paused) {
            v.play().catch(() => {
              // Autoplay with sound blocked: start muted, then restore sound
              // on the viewer's first tap anywhere on the player.
              v.muted = true;
              v.play().catch(() => {
                /* Fully blocked — leave the play button visible. */
              });
              const unmute = () => {
                v.muted = localStorage.getItem("aurora-muted") === "1";
                containerRef.current?.removeEventListener("click", unmute);
                containerRef.current?.removeEventListener("touchend", unmute);
              };
              containerRef.current?.addEventListener("click", unmute);
              containerRef.current?.addEventListener("touchend", unmute);
            });
          }
        }}
        onPlay={(e) => {
          playingRef.current = true;
          if (!startedRef.current) {
            startedRef.current = true;
            void reportPlaying({
              data: {
                itemId: playbackId,
                playSessionId: playSessionRef.current,
                deviceId: deviceIdRef.current,
                positionTicks: Math.floor(e.currentTarget.currentTime * 10_000_000),
                kind: "Started",
                mediaSourceId: mediaSourceIdRef.current,
                playMethod: playMethodRef.current,
              },
            }).catch(() => {});
            historyLogRef.current?.(true);
          }
          setPlaying(true);
          setLoading(false);
          setLoadingPercent(100);
          enterImmersiveMode();
          pokeControls();
        }}
        onPause={(e) => {
          playingRef.current = false;
          setPlaying(false);
          savePosition(e.currentTarget.currentTime);
          void reportPlaying({
            data: {
              itemId: playbackId,
              playSessionId: playSessionRef.current,
          deviceId: deviceIdRef.current,
              positionTicks: Math.floor(e.currentTarget.currentTime * 10_000_000),
              kind: "Progress",
              mediaSourceId: mediaSourceIdRef.current,
              playMethod: playMethodRef.current,
              isPaused: true,
            },
          });
        }}
        onSeeked={(e) => {
          savePosition(e.currentTarget.currentTime);
          void reportPlaying({
            data: {
              itemId: playbackId,
              playSessionId: playSessionRef.current,
          deviceId: deviceIdRef.current,
              positionTicks: Math.floor(e.currentTarget.currentTime * 10_000_000),
              kind: "Progress",
              mediaSourceId: mediaSourceIdRef.current,
              playMethod: playMethodRef.current,
              isPaused: e.currentTarget.paused,
            },
          });
        }}
        onEnded={(e) => {
          localStorage.removeItem(posKey(playbackId));
          playingRef.current = false;
          sendStopped();
          if (!markedPlayedRef.current) {
            markedPlayedRef.current = true;
            void setPlayed({ data: { itemId: playbackId, played: true } });
          }
        }}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          setTime(v.currentTime);
          if (Math.floor(v.currentTime) % 5 === 0) savePosition(v.currentTime);
          if (
            !markedPlayedRef.current &&
            v.duration > 0 &&
            v.currentTime / v.duration >= 0.92
          ) {
            markedPlayedRef.current = true;
            localStorage.removeItem(posKey(playbackId));
            void setPlayed({ data: { itemId: playbackId, played: true } });
          }
        }}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration);
          const saved = Number(localStorage.getItem("aurora-volume") ?? 1);
          if (!Number.isNaN(saved)) {
            e.currentTarget.volume = saved;
            setVolume(saved);
          }
        }}
        onProgress={(e) => {
          const v = e.currentTarget;
          if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
        }}
        onVolumeChange={(e) => {
          setMuted(e.currentTarget.muted);
          setVolume(e.currentTarget.volume);
          localStorage.setItem("aurora-muted", e.currentTarget.muted ? "1" : "0");
          localStorage.setItem("aurora-volume", String(e.currentTarget.volume));
        }}
      >
        {mediaSourceId && subtitleTracks.map((track) => (
          <track
            key={track.index}
            kind="subtitles"
            src={`/api/proxy/Videos/${playbackId}/${encodeURIComponent(mediaSourceId)}/Subtitles/${track.index}/Stream.vtt`}
            srcLang={track.language ?? "und"}
            label={track.label}
          />
        ))}
      </video>

      {loading && !playbackError && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black">
          {item.BackdropImageTags?.length || item.ImageTags?.["Primary"] ? (
            <div
              className="absolute inset-0 bg-cover bg-center opacity-40"
              style={{
                backgroundImage: `url('/api/proxy/Items/${playbackId}/Images/${
                  item.BackdropImageTags?.length ? "Backdrop" : "Primary"
                }?fillHeight=720&fillWidth=1280&quality=80')`,
              }}
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30" />
          <div className="relative z-10 flex w-full max-w-xs flex-col items-center px-6 text-center">
            <h2 className="mb-1 text-lg font-semibold text-foreground line-clamp-2">{title}</h2>
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

      {playbackError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-background/90 px-6 text-center">
          <p className="max-w-md text-sm text-foreground">{playbackError}</p>
          <Button
            type="button"
            onClick={() => retryPlaybackRef.current?.()}
            size="lg"
          >
            {t("retryPlayback")}
          </Button>
        </div>
      )}

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
            aria-label={t("back")}
            className="rounded-full p-2 text-foreground transition-colors hover:bg-accent"
          >
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-foreground sm:text-xl">{title}</h1>
            <p className="text-sm text-muted-foreground">
              {item.Type === "Episode" ? item.Name : null}
              {playMode ? (
                <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[11px] uppercase tracking-wide">
                   {playMode === "Transcode" ? t("converted") : t("direct")}
                </span>
              ) : null}
            </p>
          </div>

          <div className="relative ml-auto flex items-center gap-2">
            <LanguageSelect compact />
            {subtitleTracks.length > 0 && (
              <div className="relative">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowSubtitleMenu((value) => !value);
                    setShowAudioMenu(false);
                    pokeControls();
                  }}
                  aria-label={t("subtitles")}
                  className="rounded-full bg-black/50"
                >
                  <Captions className="h-5 w-5" />
                  <span className="hidden sm:inline">{t("subtitles")}</span>
                </Button>
                {showSubtitleMenu && (
                  <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setSubtitleIndex(null);
                        setShowSubtitleMenu(false);
                        pokeControls();
                      }}
                      className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${subtitleIndex == null ? "text-primary" : "text-foreground"}`}
                    >
                      {t("off")}
                    </button>
                    {subtitleTracks.map((track) => (
                      <button
                        key={track.index}
                        type="button"
                        onClick={() => {
                          setSubtitleIndex(track.index);
                          setShowSubtitleMenu(false);
                          pokeControls();
                        }}
                        className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${subtitleIndex === track.index ? "text-primary" : "text-foreground"}`}
                      >
                        {languageName(track.language) ?? track.label}
                        <span className="block text-xs text-muted-foreground">{track.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {audioTracks.length > 1 && (
              <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowAudioMenu((v) => !v);
                  setShowSubtitleMenu(false);
                  pokeControls();
                }}
                aria-label={t("audio")}
                className="flex items-center gap-2 rounded-full bg-black/50 px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
              >
                <Languages className="h-5 w-5" />
                <span className="hidden sm:inline">{t("audio")}</span>
              </button>
              {showAudioMenu && (
                <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-xl">
                  {audioTracks.map((track) => {
                    const active = (audioIndex ?? -1) === track.index;
                    return (
                      <button
                        key={track.index}
                        type="button"
                        onClick={() => {
                          setShowAudioMenu(false);
                          const v = videoRef.current;
                          if (v) savePosition(v.currentTime);
                          setAudioIndex(track.index);
                        }}
                        className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
                          active ? "text-primary" : "text-foreground"
                        }`}
                      >
                        {languageName(track.language) ?? track.label}
                        <span className="block text-xs text-muted-foreground">{track.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              </div>
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

        <div className="pointer-events-auto space-y-3 bg-gradient-to-t from-black via-black/70 to-transparent px-4 pt-10 pb-4 sm:px-8 sm:pb-6">
          {/* Timeline */}
          <div className="group relative flex h-6 items-center">
            <div className="relative h-1 w-full rounded-full bg-white/25 transition-all group-hover:h-1.5">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-white/40"
                style={{ width: `${duration ? (buffered / duration) * 100 : 0}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary"
                style={{ width: `${duration ? (time / duration) * 100 : 0}%` }}
              />
              <div
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary opacity-0 shadow transition-opacity group-hover:opacity-100"
                style={{ left: `${duration ? (time / duration) * 100 : 0}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={time}
              onChange={(e) => {
                const v = videoRef.current;
                const next = Number(e.target.value);
                setTime(next);
                if (v) v.currentTime = next;
                pokeControls();
              }}
              aria-label="Seek"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={togglePlay}
              aria-label={playing ? "Pause" : "Play"}
              className="rounded-full p-2 text-foreground transition-transform hover:scale-110 active:scale-95"
            >
              {playing ? (
                <Pause className="h-7 w-7 fill-current" />
              ) : (
                <Play className="h-7 w-7 fill-current" />
              )}
            </button>
            <button
              onClick={() => seekBy(-10)}
              aria-label="Rewind 10 seconds"
              className="relative rounded-full p-2 text-foreground transition-transform hover:scale-110 active:scale-95"
            >
              <RotateCcw className="h-6 w-6" />
              <span className="absolute inset-0 flex items-center justify-center pt-0.5 text-[9px] font-bold">
                10
              </span>
            </button>
            <button
              onClick={() => seekBy(10)}
              aria-label="Fast forward 10 seconds"
              className="relative rounded-full p-2 text-foreground transition-transform hover:scale-110 active:scale-95"
            >
              <RotateCw className="h-6 w-6" />
              <span className="absolute inset-0 flex items-center justify-center pt-0.5 text-[9px] font-bold">
                10
              </span>
            </button>

            <div className="group/vol flex items-center">
              <button
                onClick={() => {
                  const v = videoRef.current;
                  if (v) v.muted = !v.muted;
                  pokeControls();
                }}
                aria-label={muted ? "Unmute" : "Mute"}
                className="rounded-full p-2 text-foreground transition-transform hover:scale-110 active:scale-95"
              >
                {muted || volume === 0 ? (
                  <VolumeX className="h-6 w-6" />
                ) : (
                  <Volume2 className="h-6 w-6" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                onChange={(e) => {
                  const v = videoRef.current;
                  const next = Number(e.target.value);
                  setVolume(next);
                  if (v) {
                    v.volume = next;
                    v.muted = next === 0;
                  }
                  pokeControls();
                }}
                aria-label="Volume"
                className="h-1 w-0 cursor-pointer accent-[var(--color-primary)] opacity-0 transition-all duration-200 group-hover/vol:w-24 group-hover/vol:opacity-100 focus:w-24 focus:opacity-100"
              />
            </div>

            <span className="ml-2 text-xs tabular-nums text-foreground/80">
              {formatTime(time)} <span className="text-foreground/50">/ {formatTime(duration)}</span>
            </span>

            <button
              onClick={toggleFullscreen}
              aria-label="Fullscreen"
              className="ml-auto rounded-full p-2 text-foreground transition-transform hover:scale-110 active:scale-95"
            >
              <Maximize className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
