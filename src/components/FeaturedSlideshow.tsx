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
      onPointerDown={pauseBriefly}
      className="group relative h-[74svh] min-h-[500px] max-h-[820px] w-full overflow-hidden bg-muted sm:h-[72vh] sm:min-h-[560px] 2xl:h-[78vh] 2xl:min-h-[680px] 2xl:max-h-[900px]"
    >
      {slides.map((slide, index) => (
        <img
          key={slide.Id}
          src={backdropUrl(slide)}
          alt={index === activeIndex ? slide.Name : ""}
          aria-hidden={index !== activeIndex}
          loading={index === 0 ? "eager" : "lazy"}
          className={`absolute inset-0 h-full w-full object-cover object-center transition-[opacity,transform] duration-1000 motion-reduce:transition-none max-sm:object-[60%_center] ${
            index === activeIndex ? "scale-100 opacity-100" : "scale-[1.02] opacity-0"
          }`}
        />
      ))}

      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/45 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/20" />

      <div key={active.Id} className="hero-copy absolute inset-x-0 bottom-0 px-4 pb-14 sm:px-8 sm:pb-24 2xl:px-16 2xl:pb-28">
        <div className="max-w-[min(44rem,calc(100vw-2rem))] space-y-2.5 sm:max-w-3xl sm:space-y-5 2xl:max-w-4xl">
          <h1 className="line-clamp-2 text-3xl font-black leading-none tracking-normal text-foreground drop-shadow-lg min-[430px]:text-4xl sm:text-6xl lg:text-7xl 2xl:text-8xl">
            {active.SeriesName ?? active.Name}
          </h1>
          <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-foreground/75 sm:gap-3 sm:text-sm 2xl:text-lg">
            {active.ProductionYear && <span>{active.ProductionYear}</span>}
            {active.OfficialRating && (
              <span className="rounded border border-border px-1.5 py-0.5 text-xs">
                {active.OfficialRating}
              </span>
            )}
            {active.RunTimeTicks ? <span>{formatRuntime(active.RunTimeTicks)}</span> : null}
          </div>
          {active.Overview && (
            <p className="line-clamp-2 max-w-2xl text-sm leading-relaxed text-foreground/85 drop-shadow-md sm:line-clamp-3 sm:text-lg 2xl:max-w-3xl 2xl:text-xl">
              {active.Overview}
            </p>
          )}
          <div className="grid max-w-md grid-cols-2 gap-2 pt-1 sm:flex sm:items-center sm:gap-3">
            <Button asChild size="lg" className="min-w-0 px-3 font-bold bg-foreground text-background hover:bg-foreground/85 sm:px-8 2xl:h-14 2xl:text-lg">
              <Link to="/watch/$id" params={{ id: active.Id }}>
                <Play className="fill-current" /> {t("play")}
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="min-w-0 px-3 font-bold bg-accent/85 backdrop-blur-sm hover:bg-accent sm:px-8 2xl:h-14 2xl:text-lg">
              <Link to="/title/$id" params={{ id: active.Id }} className="min-w-0">
                <Info className="shrink-0" /> <span className="truncate">{t("moreInfo")}</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {slides.length > 1 && (
        <>
          <div className="absolute bottom-4 left-4 flex items-center gap-1.5 sm:bottom-8 sm:left-8 sm:gap-2 2xl:left-16">
            {slides.map((slide, index) => (
              <Button
                key={slide.Id}
                type="button"
                variant="ghost"
                aria-label={`${t("showSlide")} ${index + 1}: ${slide.Name}`}
                aria-current={index === activeIndex}
                onClick={() => {
                  show(index);
                  pauseBriefly();
                }}
                className={`h-6 min-w-0 rounded-full p-0 transition-[width,background-color] duration-300 ${
                  index === activeIndex ? "w-8 bg-foreground" : "w-3 bg-foreground/40 hover:bg-foreground/70"
                }`}
              />
            ))}
          </div>
          <div className="absolute bottom-7 right-8 hidden gap-2 opacity-0 transition-opacity sm:flex sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 2xl:right-16">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              aria-label={t("previous")}
              onClick={() => {
                show(activeIndex - 1);
                pauseBriefly();
              }}
              className="rounded-full bg-background/65 backdrop-blur-md hover:bg-background/90"
            >
              <ChevronLeft />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              aria-label={t("next")}
              onClick={() => {
                show(activeIndex + 1);
                pauseBriefly();
              }}
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