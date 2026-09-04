import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { FilterBar, filterItems, useMediaFilter } from "@/components/FilterBar";
import { MediaCard } from "@/components/MediaCard";
import { TopNav } from "@/components/TopNav";
import { getSessionFn } from "@/lib/auth.functions";
import { getItemFn, getLibraryItemsFn } from "@/lib/jellyfin.functions";

export const Route = createFileRoute("/library/$id")({
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (!session) throw redirect({ to: "/login" });
  },
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(
        queryOptions({
          queryKey: ["library", params.id],
          queryFn: () => getLibraryItemsFn({ data: { viewId: params.id } }),
        }),
      ),
      context.queryClient.ensureQueryData(
        queryOptions({
          queryKey: ["view", params.id],
          queryFn: () => getItemFn({ data: { id: params.id } }),
        }),
      ),
    ]),
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.[1]?.Name ?? "Library"} — Aurora` },
      { name: "description", content: `Browse ${loaderData?.[1]?.Name ?? "your library"} on Aurora.` },
      { property: "og:title", content: `${loaderData?.[1]?.Name ?? "Library"} — Aurora` },
      { property: "og:description", content: `Browse ${loaderData?.[1]?.Name ?? "your library"} on Aurora.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const { id } = Route.useParams();
  const { data: items } = useSuspenseQuery(
    queryOptions({
      queryKey: ["library", id],
      queryFn: () => getLibraryItemsFn({ data: { viewId: id } }),
    }),
  );
  const { data: view } = useSuspenseQuery(
    queryOptions({
      queryKey: ["view", id],
      queryFn: () => getItemFn({ data: { id } }),
    }),
  );

  const [filter, setFilter] = useMediaFilter();
  const filtered = filterItems(items, filter);

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNav userName="" />
      <div className="space-y-6 px-4 pt-24 sm:px-8">
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">{view.Name}</h1>
        <FilterBar items={items} value={filter} onChange={setFilter} />
        {filtered.length ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
            {filtered.map((item) => (
              <MediaCard key={item.Id} item={item} />
            ))}
          </div>
        ) : (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Nothing matches those filters.
          </p>
        )}
      </div>
    </div>
  );
}
