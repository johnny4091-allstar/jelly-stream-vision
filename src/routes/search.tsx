import { queryOptions, useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import { MediaCard } from "@/components/MediaCard";
import { TopNav } from "@/components/TopNav";
import { getSessionFn } from "@/lib/auth.functions";
import { searchFn } from "@/lib/jellyfin.functions";

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
  const [term, setTerm] = useState("");
  const { data: results, isFetching } = useQuery(
    queryOptions({
      queryKey: ["search", term],
      queryFn: () => searchFn({ data: { term } }),
      enabled: term.trim().length > 0,
    }),
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNav userName="" />
      <div className="mx-auto max-w-5xl space-y-8 px-4 pt-24 sm:px-8">
        <input
          type="search"
          autoFocus
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search movies and shows…"
          className="w-full rounded-lg border border-input bg-card px-5 py-4 text-lg text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/40"
        />
        {isFetching && <p className="text-sm text-muted-foreground">Searching…</p>}
        {results && results.length === 0 && !isFetching && (
          <p className="text-sm text-muted-foreground">No results for “{term}”.</p>
        )}
        {results && results.length > 0 && (
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {results.map((item) => (
              <MediaCard key={item.Id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
