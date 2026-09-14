import { queryOptions, useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Search as SearchIcon, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { MediaCard } from "@/components/MediaCard";
import { Row } from "@/components/Row";
import { TopNav } from "@/components/TopNav";
import { getSessionFn } from "@/lib/auth.functions";
import { getRecommendationsFn, searchFn, searchSuggestFn } from "@/lib/jellyfin.functions";
import { itemImageUrl } from "@/lib/jellyfin.types";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/search")({
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (!session) throw redirect({ to: "/login" });
  },
  head: () => ({
    meta: [
      { title: "Search — Aurora" },
      { name: "description", content: "Search your movies and shows on Aurora." },
      { property: "og:title", content: "Search — Aurora" },
      { property: "og:description", content: "Search your movies and shows on Aurora." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(term.trim()), 220);
    return () => clearTimeout(id);
  }, [term]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const suggestions = useQuery(
    queryOptions({
      queryKey: ["search-suggest", debounced],
      queryFn: () => searchSuggestFn({ data: { term: debounced } }),
      enabled: debounced.length > 1,
      staleTime: 60_000,
    }),
  );

  const { data: results, isFetching } = useQuery(
    queryOptions({
      queryKey: ["search", debounced],
      queryFn: () => searchFn({ data: { term: debounced } }),
      enabled: debounced.length > 0,
    }),
  );

  const recommended = useQuery(
    queryOptions({
      queryKey: ["recommendations"],
      queryFn: () => getRecommendationsFn(),
      staleTime: 10 * 60_000,
    }),
  );

  const showSuggestions = open && debounced.length > 1 && (suggestions.data?.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNav userName="" />
      <div className="mx-auto max-w-6xl space-y-10 px-4 pt-24 sm:px-8">
        <div ref={boxRef} className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-5 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            autoFocus
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={t("searchPlaceholder")}
            className="w-full rounded-full border border-input bg-card py-4 pr-12 pl-14 text-lg text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/40"
          />
          {term && (
            <button
              type="button"
              onClick={() => {
                setTerm("");
                setOpen(false);
              }}
              className="absolute top-1/2 right-4 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground"
              aria-label={t("clear")}
            >
              <X className="h-5 w-5" />
            </button>
          )}

          {showSuggestions && (
            <ul className="absolute top-full right-0 left-0 z-40 mt-2 overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
              {(suggestions.data ?? []).map((item) => (
                <li key={item.Id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      void navigate({ to: "/title/$id", params: { id: item.SeriesId ?? item.Id } });
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent"
                  >
                    <img
                      src={itemImageUrl(item.Id, "Primary", 80)}
                      alt=""
                      loading="lazy"
                      className="h-14 w-10 shrink-0 rounded object-cover bg-secondary"
                      onError={(e) => {
                        e.currentTarget.style.visibility = "hidden";
                      }}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {item.Name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {item.Type === "Series" ? "Series" : "Movie"}
                        {item.ProductionYear ? ` · ${item.ProductionYear}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {isFetching && debounced && <p className="text-sm text-muted-foreground">Searching…</p>}
        {results && results.length === 0 && !isFetching && debounced && (
          <p className="text-sm text-muted-foreground">No results for “{debounced}”.</p>
        )}
        {results && results.length > 0 && (
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {results.map((item) => (
              <MediaCard key={item.Id} item={item} />
            ))}
          </div>
        )}

        {!debounced && (recommended.data?.items.length ?? 0) > 0 && (
          <div className="-mx-4 sm:-mx-8">
            <Row
              title={
                recommended.data?.seedTitle
                  ? `${t("becauseYouWatched")} ${recommended.data.seedTitle}`
                  : t("recommended")
              }
              items={recommended.data?.items ?? []}
            />
          </div>
        )}
      </div>
    </div>
  );
}
