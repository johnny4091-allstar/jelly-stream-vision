import { useMemo, useState } from "react";
import { X } from "lucide-react";

import type { JfItem } from "@/lib/jellyfin.types";
import type { PosterRecord } from "@/lib/posters.types";
import { useLanguage } from "@/lib/i18n";

export interface MediaFilter {
  genre: string;
  year: string;
  rating: string;
}

export const emptyFilter: MediaFilter = { genre: "", year: "", rating: "" };

export type PosterIndex = Map<string, PosterRecord>;

export function buildPosterIndex(posters: PosterRecord[]): PosterIndex {
  return new Map(posters.map((p) => [p.jfItemId, p]));
}

/** Attributes for an item, preferring the saved poster entry. */
function attrs(item: JfItem, index?: PosterIndex) {
  const key = item.Type === "Episode" && item.SeriesId ? item.SeriesId : item.Id;
  const p = index?.get(key);
  return {
    genres: p?.genres?.length ? p.genres : (item.Genres ?? []),
    year: String(p?.year ?? item.ProductionYear ?? ""),
    rating: p?.rating ?? item.OfficialRating ?? "",
  };
}

export function filterItems(items: JfItem[], f: MediaFilter, index?: PosterIndex): JfItem[] {
  if (!f.genre && !f.year && !f.rating) return items;
  return items.filter((i) => {
    const a = attrs(i, index);
    if (f.genre && !a.genres.includes(f.genre)) return false;
    if (f.year && a.year !== f.year) return false;
    if (f.rating && a.rating !== f.rating) return false;
    return true;
  });
}

export function filterPosters(posters: PosterRecord[], f: MediaFilter): PosterRecord[] {
  return posters.filter((p) => {
    if (f.genre && !p.genres.includes(f.genre)) return false;
    if (f.year && String(p.year ?? "") !== f.year) return false;
    if (f.rating && (p.rating ?? "") !== f.rating) return false;
    return true;
  });
}

function options(posters: PosterRecord[], pick: (p: PosterRecord) => (string | number | null | undefined)[]): string[] {
  const set = new Set<string>();
  for (const p of posters) for (const v of pick(p)) if (v !== undefined && v !== null && v !== "") set.add(String(v));
  return [...set].sort((a, b) => (Number(a) && Number(b) ? Number(b) - Number(a) : a.localeCompare(b)));
}

const selectCls =
  "min-w-0 max-w-[10rem] flex-1 rounded-md border border-border bg-card px-2.5 py-1.5 sm:flex-none text-xs text-foreground outline-none focus:border-primary sm:text-sm";

export function FilterBar({ posters, value, onChange }: {
  posters: PosterRecord[];
  value: MediaFilter;
  onChange: (f: MediaFilter) => void;
}) {
  const { t } = useLanguage();
  const genres = useMemo(() => options(posters, (p) => p.genres), [posters]);
  const years = useMemo(() => options(posters, (p) => [p.year]), [posters]);
  const ratings = useMemo(() => options(posters, (p) => [p.rating]), [posters]);
  const active = value.genre || value.year || value.rating;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label={t("allGenres")}
        className={selectCls}
        value={value.genre}
        onChange={(e) => onChange({ ...value, genre: e.target.value })}
      >
        <option value="">{t("allGenres")}</option>
        {genres.map((g) => <option key={g} value={g}>{g}</option>)}
      </select>
      <select
        aria-label={t("allYears")}
        className={selectCls}
        value={value.year}
        onChange={(e) => onChange({ ...value, year: e.target.value })}
      >
        <option value="">{t("allYears")}</option>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <select
        aria-label={t("allRatings")}
        className={selectCls}
        value={value.rating}
        onChange={(e) => onChange({ ...value, rating: e.target.value })}
      >
        <option value="">{t("allRatings")}</option>
        {ratings.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      {active && (
        <button
          type="button"
          onClick={() => onChange(emptyFilter)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" /> {t("clear")}
        </button>
      )}
    </div>
  );
}

export function useMediaFilter(): [MediaFilter, (f: MediaFilter) => void] {
  return useState<MediaFilter>(emptyFilter);
}
