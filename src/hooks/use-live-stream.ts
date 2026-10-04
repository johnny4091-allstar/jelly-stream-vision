import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";

import { getPlaybackInfoFn, reportPlayingFn, stopTranscodeFn } from "@/lib/jellyfin.functions";

type LiveStreamOptions = {
  itemId: string | null;
  enabled?: boolean;
  muted?: boolean;
  streamFailedMessage: string;
  streamInterruptedMessage: string;
};

export function useLiveStream({
  itemId,
  enabled = true,
  muted = false,
  streamFailedMessage,
  streamInterruptedMessage,
}: LiveStreamOptions) {
  const getPlaybackInfo = useServerFn(getPlaybackInfoFn);
  const reportPlaying = useServerFn(reportPlayingFn);
  const stopTranscode = useServerFn(stopTranscodeFn);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playSessionRef = useRef("");
  const startedRef = useRef(false);
  const infoRef = useRef<{
    mediaSourceId?: string;
    playMethod?: "DirectPlay" | "DirectStream" | "Transcode";
    liveStreamId?: string;
  }>({});
  const deviceIdRef = useRef("");
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(Boolean(enabled && itemId));
  const [loadingPercent, setLoadingPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sessionNonce, setSessionNonce] = useState(0);
  const autoRetriedRef = useRef(false);
  const previousItemRef = useRef<string | null>(null);

  if (!deviceIdRef.current) {
    let stored = typeof localStorage !== "undefined" ? localStorage.getItem("aurora-device-id") : null;
    if (!stored) {
      stored = `aurora-web-${Math.random().toString(36).slice(2, 10)}`;
      if (typeof localStorage !== "undefined") localStorage.setItem("aurora-device-id", stored);
    }
    deviceIdRef.current = stored;
  }

  const retry = useCallback(() => {
    autoRetriedRef.current = true;
    setError(null);
    setSessionNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    if (previousItemRef.current !== itemId) {
      previousItemRef.current = itemId;
      autoRetriedRef.current = false;
    }
  }, [itemId]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    if (!enabled || !itemId) {
      setLoading(false);
      setPlaying(false);
      return;
    }

    let cancelled = false;
    let hls: import("hls.js").default | null = null;
    let networkRecoveries = 0;
    let mediaRecoveries = 0;
    let everPlayed = false;
    let lastTime = -1;
    let lastAdvanceAt = Date.now();
    let healthySeconds = 0;
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;

    const report = (kind: "Started" | "Progress" | "Stopped", isPaused = false) => {
      if (!playSessionRef.current) return;
      const info = infoRef.current;
      void reportPlaying({
        data: {
          itemId,
          positionTicks: Math.floor((video.currentTime || 0) * 10_000_000),
          playSessionId: playSessionRef.current,
          kind,
          isPaused,
          deviceId: deviceIdRef.current,
          ...(info.mediaSourceId ? { mediaSourceId: info.mediaSourceId } : {}),
          ...(info.playMethod ? { playMethod: info.playMethod } : {}),
          ...(info.liveStreamId ? { liveStreamId: info.liveStreamId } : {}),
        },
      }).catch(() => {});
    };

    const stopSession = () => {
      if (startedRef.current) {
        startedRef.current = false;
        report("Stopped");
      }
      const playSessionId = playSessionRef.current;
      playSessionRef.current = "";
      if (playSessionId) {
        void stopTranscode({ data: { playSessionId, deviceId: deviceIdRef.current } });
      }
    };

    const freshSession = () => {
       if (cancelled) {
         if (info.playSessionId) {
           void stopTranscode({ data: { playSessionId: info.playSessionId, deviceId: deviceIdRef.current } });
         }
         return;
       }
      if (!autoRetriedRef.current) {
        autoRetriedRef.current = true;
        setSessionNonce((value) => value + 1);
      } else {
        setError(streamInterruptedMessage);
      }
    };

    const onPlaying = () => {
      everPlayed = true;
      lastAdvanceAt = Date.now();
      setPlaying(true);
      setLoading(false);
      setLoadingPercent(100);
      if (!startedRef.current) {
        startedRef.current = true;
        report("Started");
      }
    };
    const onPause = () => {
      setPlaying(false);
      if (startedRef.current) report("Progress", true);
    };
    const onError = () => freshSession();
    video.addEventListener("playing", onPlaying);
    video.addEventListener("pause", onPause);
    video.addEventListener("error", onError);

    const progressTimer = setInterval(() => {
      if (!video.paused && startedRef.current) report("Progress");
    }, 10_000);
    const watchdog = setInterval(() => {
      if (video.paused || cancelled) {
        lastAdvanceAt = Date.now();
        return;
      }
      if (video.currentTime > lastTime + 0.5) {
        lastAdvanceAt = Date.now();
        healthySeconds += 5;
        if (healthySeconds >= 30) {
          networkRecoveries = 0;
          mediaRecoveries = 0;
          autoRetriedRef.current = false;
        }
      } else {
        healthySeconds = 0;
        if (everPlayed && Date.now() - lastAdvanceAt >= 20_000) {
          lastAdvanceAt = Date.now();
          freshSession();
        }
      }
      lastTime = video.currentTime;
    }, 5_000);
    const safetyTimer = setTimeout(() => {
      if (cancelled) return;
      setLoadingPercent(100);
      setLoading(false);
      void video.play().catch(() => {});
    }, 12_000);

    async function setup() {
      setError(null);
      setLoading(true);
      setLoadingPercent(15);
      const hlsModule = import("hls.js");
      let info: Awaited<ReturnType<typeof getPlaybackInfo>>;
      try {
        info = await getPlaybackInfo({ data: { itemId, deviceId: deviceIdRef.current } });
      } catch {
        if (!autoRetriedRef.current) freshSession();
        else setError(streamFailedMessage);
        return;
      }
      if (cancelled) return;
      playSessionRef.current = info.playSessionId;
      infoRef.current = {
        mediaSourceId: info.mediaSourceId,
        playMethod: info.playMethod,
        ...(info.liveStreamId ? { liveStreamId: info.liveStreamId } : {}),
      };
      setLoadingPercent(35);
      const params = new URLSearchParams({
        mediaSourceId: info.mediaSourceId,
        PlaySessionId: info.playSessionId,
        DeviceId: deviceIdRef.current,
        VideoCodec: "h264",
        AudioCodec: "aac",
        MaxAudioChannels: "2",
        TranscodingMaxAudioChannels: "2",
        SegmentContainer: "ts",
        SubtitleStreamIndex: "-1",
        SubtitleMethod: "External",
      });
      const streamUrl = info.transcodingUrl
        ? `/api/proxy${info.transcodingUrl}`
        : `/api/proxy/Videos/${itemId}/master.m3u8?${params.toString()}`;
      const { default: Hls } = await hlsModule;
      if (cancelled) return;
      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          liveSyncDurationCount: 2,
          maxBufferLength: 10,
          maxMaxBufferLength: 30,
          backBufferLength: 10,
          startFragPrefetch: true,
          manifestLoadingTimeOut: 20_000,
          manifestLoadingMaxRetry: 6,
          levelLoadingTimeOut: 20_000,
          levelLoadingMaxRetry: 8,
          fragLoadingTimeOut: 60_000,
          fragLoadingMaxRetry: 10,
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
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
          freshSession();
        });
        hls.on(Hls.Events.MEDIA_ATTACHED, () => hls?.loadSource(streamUrl));
        hls.on(Hls.Events.LEVEL_LOADED, () => setLoadingPercent((value) => Math.max(value, 50)));
        hls.on(Hls.Events.FRAG_BUFFERED, () => {
          setLoadingPercent((value) => Math.min(95, value + 20));
          setLoading(false);
          void video.play().catch(() => {});
        });
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setLoadingPercent((value) => Math.max(value, 50));
          void video.play().catch(() => {});
        });
        hls.attachMedia(video);
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = streamUrl;
        setLoadingPercent(60);
        video.load();
        void video.play().catch(() => {});
      } else {
        setError(streamFailedMessage);
      }
    }

    void setup();
    return () => {
      cancelled = true;
      clearInterval(progressTimer);
      clearInterval(watchdog);
      clearTimeout(safetyTimer);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("error", onError);
      stopSession();
      try {
        hls?.destroy();
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch {
        /* the stream may already be detached */
      }
    };
    // Server functions are stable; changing item/session is the lifecycle boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [enabled, itemId, sessionNonce]);

  return {
    videoRef,
    playing,
    loading,
    loadingPercent,
    error,
    retry,
    togglePlay: () => {
      const video = videoRef.current;
      if (!video) return;
      if (video.paused) void video.play().catch(() => {});
      else video.pause();
    },
  };
}