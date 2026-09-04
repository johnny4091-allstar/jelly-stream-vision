import { useMemo, useState } from "react";
import { X } from "lucide-react";

import type { JfItem } from "@/lib/jellyfin.types";

export interface MediaFilter {
  genre: string;
  year: string;
  rating: string;
}

export const emptyFilter: MediaFilter = { genre: "", year: "", rating: "" };

export function filterItems(items: JfItem[], f: MediaFilter): JfItem[] {
  return items.filter((i) => {
    if (f.genre && !(i.Genres ?? []).includes(f.genre)) return false;
    if (f.year && String(i.ProductionYear ?? "") !== f.year) return false;
    if (f.rating && (i.OfficialRating ?? "") !== f.rating) return false;
    return true;
  });
}

function options(items: JfItem[], pick: (i: JfItem) => (string | number | undefined)[]): string[] {
  const set = new Set<string>();
  for (const i of items) for (const v of pick(i)) if (v !== undefined && v !== "") set.add(String(v));
  return [...set].sort((a, b) => (Number(a) && Number(b) ? Number(b) - Number(a) : a.localeCompare(b)));
}

const selectCls =
  "rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary sm:text-sm";

export function FilterBar({ items, value, onChange }: {
  items: JfItem[];
  value: MediaFilter;
  onChange: (f: MediaFilter) => void;
}) {
  const genres = useMemo(() => options(items, (i) => i.Genres ?? []), [items]);
  const years = useMemo(() => options(items, (i) => [i.ProductionYear]), [items]);
  const ratings = useMemo(() => options(items, (i) => [i.OfficialRating]), [items]);
  const active = value.genre || value.year || value.rating;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Filter by genre"
        className={selectCls}
        value={value.genre}
        onChange={(e) => onChange({ ...value, genre: e.target.value })}
      >
        <option value="">All genres</option>
        {genres.map((g) => <option key={g} value={g}>{g}</option>)}
      </select>
      <select
        aria-label="Filter by year"
        className={selectCls}
        value={value.year}
        onChange={(e) => onChange({ ...value, year: e.target.value })}
      >
        <option value="">All years</option>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <select
        aria-label="Filter by rating"
        className={selectCls}
        value={value.rating}
        onChange={(e) => onChange({ ...value, rating: e.target.value })}
      >
        <option value="">All ratings</option>
        {ratings.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      {active && (
        <button
          type="button"
          onClick={() => onChange(emptyFilter)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" /> Clear
        </button>
      )}
    </div>
  );
}

export function useMediaFilter(): [MediaFilter, (f: MediaFilter) => void] {
  return useState<MediaFilter>(emptyFilter);
}
