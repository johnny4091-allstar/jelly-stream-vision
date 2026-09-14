import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Info, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { backdropUrl, formatRuntime, type JfItem } from "@/lib/jellyfin.types";

const ROTATION_MS = 8_000;

function slideshowItems(items: JfItem[]) {
  const unique = new Map<string, JfItem>();
  for (const item of items) {
    if ((item.Type === "Movie" || item.Type === "Series") && !unique.has(item.Id)) {
      unique.set(item.Id, item);
    }
  }
  return [...unique.values()]
    .sort((a, b) => Number(Boolean(b.BackdropImageTags?.length)) - Number(Boolean(a.BackdropImageTags?.length)))
    .slice(0, 7);
}

export function FeaturedSlideshow({ items }: { items: JfItem[] }) {
  const { t } = useLanguage();
  const slides = useMemo(() => slideshowItems(items), [items]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (index: number) => {
    if (!slides.length) return;
    setActiveIndex((index + slides.length) % slides.length);
  };

  const pauseBriefly = () => {
    setPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setPaused(false), 12_000);
  };

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, ROTATION_MS);
    return () => window.clearInterval(timer);
  }, [paused, slides.length]);

  useEffect(() => {
    const next = slides[(activeIndex + 1) % slides.length];
    if (!next) return;
    const image = new Image();
    image.src = backdropUrl(next);
  }, [activeIndex, slides]);

  useEffect(() => () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  }, []);

  const active = slides[activeIndex];
  if (!active) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t("featured")}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
      onPointerDown={pauseBriefly}
      className="group relative h-[78svh] min-h-[500px] max-h-[820px] w-full overflow-hidden bg-muted sm:h-[72vh] sm:min-h-[560px]"
    >
      {slides.map((slide, index) => (
        <img
          key={slide.Id}
          src={backdropUrl(slide)}
          alt={index === activeIndex ? slide.Name : ""}
          aria-hidden={index !== activeIndex}
          loading={index === 0 ? "eager" : "lazy"}
          className={`absolute inset-0 h-full w-full object-cover object-center transition-[opacity,transform] duration-1000 motion-reduce:transition-none ${
            index === activeIndex ? "scale-100 opacity-100" : "scale-[1.02] opacity-0"
          }`}
        />
      ))}

      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/45 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/20" />

      <div key={active.Id} className="hero-copy absolute inset-x-0 bottom-0 px-4 pb-16 sm:px-8 sm:pb-24">
        <div className="max-w-3xl space-y-3 sm:space-y-5">
          <h1 className="max-w-[90vw] text-4xl font-black leading-none tracking-normal text-foreground drop-shadow-lg sm:text-6xl lg:text-7xl">
            {active.SeriesName ?? active.Name}
          </h1>
          <div className="flex items-center gap-3 text-sm font-medium text-foreground/75">
            {active.ProductionYear && <span>{active.ProductionYear}</span>}
            {active.OfficialRating && (
              <span className="rounded border border-border px-1.5 py-0.5 text-xs">
                {active.OfficialRating}
              </span>
            )}
            {active.RunTimeTicks ? <span>{formatRuntime(active.RunTimeTicks)}</span> : null}
          </div>
          {active.Overview && (
            <p className="line-clamp-3 max-w-2xl text-sm leading-relaxed text-foreground/85 drop-shadow-md sm:text-lg">
              {active.Overview}
            </p>
          )}
          <div className="flex items-center gap-2 pt-1 sm:gap-3">
            <Button asChild size="lg" className="bg-foreground font-bold text-background hover:bg-foreground/85">
              <Link to="/watch/$id" params={{ id: active.Id }}>
                <Play className="fill-current" /> {t("play")}
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="bg-accent/85 font-bold backdrop-blur-sm hover:bg-accent">
              <Link to="/title/$id" params={{ id: active.Id }}>
                <Info /> {t("moreInfo")}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {slides.length > 1 && (
        <>
          <div className="absolute bottom-5 left-4 flex items-center gap-2 sm:bottom-8 sm:left-8">
            {slides.map((slide, index) => (
              <button
                key={slide.Id}
                type="button"
                aria-label={`${t("showSlide")} ${index + 1}: ${slide.Name}`}
                aria-current={index === activeIndex}
                onClick={() => show(index)}
                className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ${
                  index === activeIndex ? "w-8 bg-foreground" : "w-3 bg-foreground/40 hover:bg-foreground/70"
                }`}
              />
            ))}
          </div>
          <div className="absolute bottom-4 right-4 flex gap-2 opacity-100 transition-opacity sm:bottom-7 sm:right-8 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              aria-label={t("previous")}
              onClick={() => show(activeIndex - 1)}
              className="rounded-full bg-background/65 backdrop-blur-md hover:bg-background/90"
            >
              <ChevronLeft />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              aria-label={t("next")}
              onClick={() => show(activeIndex + 1)}
              className="rounded-full bg-background/65 backdrop-blur-md hover:bg-background/90"
            >
              <ChevronRight />
            </Button>
          </div>
        </>
      )}
    </section>
  );
}