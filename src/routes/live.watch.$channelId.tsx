import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft, Maximize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useLiveStream } from "@/hooks/use-live-stream";
import { getSessionFn } from "@/lib/auth.functions";
import { useLanguage } from "@/lib/i18n";
import { getLiveChannelFn } from "@/lib/livetv.functions";

export const Route = createFileRoute("/live/watch/$channelId")({
  beforeLoad: async () => { if (!(await getSessionFn())) throw redirect({ to: "/login" }); },
  head: () => ({ meta: [
    { title: "Live channel — Aurora" },
    { name: "description", content: "Watching live TV on Aurora." },
    { property: "og:title", content: "Live channel — Aurora" },
    { property: "og:description", content: "Watching live TV on Aurora." },
    { property: "og:type", content: "video.other" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: LiveWatchPage,
});

function LiveWatchPage() {
  const { t } = useLanguage();
  const { channelId } = Route.useParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [muted, setMuted] = useState(false);
  const channel = useQuery({ queryKey: ["live-channel", channelId], queryFn: () => getLiveChannelFn({ data: { channelId } }), staleTime: 60_000 });
  const stream = useLiveStream({ itemId: channelId, muted, streamFailedMessage: t("streamFailed"), streamInterruptedMessage: t("streamInterrupted") });

  const pokeControls = () => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 5000);
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void containerRef.current?.requestFullscreen?.().catch(() => {});
  };
  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);
  useEffect(() => {
    containerRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (["Enter", " ", "MediaPlayPause"].includes(event.key)) { event.preventDefault(); stream.togglePlay(); }
      else if (event.key === "MediaPlay") { event.preventDefault(); void stream.videoRef.current?.play().catch(() => {}); }
      else if (event.key === "MediaPause") { event.preventDefault(); stream.videoRef.current?.pause(); }
      else if (["Escape", "Backspace", "GoBack"].includes(event.key)) {
        if (document.fullscreenElement) { event.preventDefault(); void document.exitFullscreen(); }
        else window.history.back();
      }
      pokeControls();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // Key listener intentionally remains stable for the lifetime of this player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={containerRef} className="relative h-screen w-screen bg-background outline-none" onMouseMove={pokeControls} onTouchStart={pokeControls} tabIndex={0}>
      <video
        ref={stream.videoRef}
        className="h-full w-full touch-manipulation bg-background"
        playsInline
        autoPlay
        muted={muted}
        onClick={stream.togglePlay}
        onPlay={() => {
          pokeControls();
          if (!document.fullscreenElement) void containerRef.current?.requestFullscreen?.().catch(() => {});
        }}
        onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
      />
      {stream.loading && !stream.error && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background px-6 text-center"><h2 className="mb-2 text-lg font-semibold text-foreground">{channel.data?.name ?? t("liveTv")}</h2><p className="mb-8 text-sm text-muted-foreground">{t("loadingStream")}</p><div className="text-5xl font-bold tabular-nums text-foreground">{stream.loadingPercent}%</div><div className="mt-8 h-1 w-full max-w-xs overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary transition-[width]" style={{ width: `${stream.loadingPercent}%` }} /></div></div>}
      {stream.error && <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-background/90 px-6 text-center"><p className="max-w-md text-sm text-foreground">{stream.error}</p><Button type="button" size="lg" onClick={stream.retry}>{t("retryPlayback")}</Button></div>}
      <div className={`pointer-events-none absolute inset-0 flex flex-col justify-between transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}>
        <div className="pointer-events-auto flex items-center gap-4 bg-gradient-to-b from-background to-transparent p-4 sm:p-6"><Button asChild size="icon" variant="ghost"><Link to="/live" aria-label={t("back")}><ArrowLeft /></Link></Button><div className="min-w-0"><h1 className="truncate text-lg font-bold text-foreground sm:text-xl">{channel.data?.name ?? t("liveTv")}</h1><p className="truncate text-sm text-muted-foreground"><span className="mr-2 rounded bg-primary px-1.5 py-0.5 text-[11px] font-bold uppercase text-primary-foreground">{t("liveBadge")}</span>{channel.data?.now?.name ?? ""}</p></div></div>
        <div className="pointer-events-auto flex items-center justify-center"><Button type="button" size="icon" variant="secondary" className="h-20 w-20 rounded-full" onClick={stream.togglePlay} aria-label={stream.playing ? "Pause" : "Play"}>{stream.playing ? <Pause className="h-10 w-10 fill-current" /> : <Play className="h-10 w-10 fill-current" />}</Button></div>
        <div className="pointer-events-auto flex items-center gap-2 bg-gradient-to-t from-background to-transparent p-4 sm:p-6"><Button type="button" size="icon" variant="ghost" onClick={stream.togglePlay} aria-label={stream.playing ? "Pause" : "Play"}>{stream.playing ? <Pause className="fill-current" /> : <Play className="fill-current" />}</Button><Button type="button" size="icon" variant="ghost" onClick={() => { const video = stream.videoRef.current; if (video) { video.muted = !video.muted; setMuted(video.muted); } }} aria-label={muted ? "Unmute" : "Mute"}>{muted ? <VolumeX /> : <Volume2 />}</Button><Button type="button" size="icon" variant="ghost" className="ml-auto" onClick={toggleFullscreen} aria-label="Fullscreen"><Maximize /></Button></div>
      </div>
    </div>
  );
}
