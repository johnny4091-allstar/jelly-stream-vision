import { RouteError } from "@/components/RouteError";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { MediaCard } from "@/components/MediaCard";
import { TopNav } from "@/components/TopNav";
import { getSessionFn } from "@/lib/auth.functions";
import { useLanguage } from "@/lib/i18n";
import { homeQuery } from "@/routes/index";

export const Route = createFileRoute("/continue-watching")({
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (!session) throw redirect({ to: "/login" });
  },
  loader: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(homeQuery);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Unauthorized")) throw redirect({ to: "/login" });
      throw err;
    }
  },
  head: () => ({
    meta: [
      { title: "Aurora — Continue Watching" },
      { name: "description", content: "Pick up movies, shows and live channels where you left off." },
      { property: "og:title", content: "Aurora — Continue Watching" },
      { property: "og:description", content: "Pick up movies, shows and live channels where you left off." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: RouteError,
  component: ContinueWatchingPage,
});

function ContinueWatchingPage() {
  const { t } = useLanguage();
  const { data } = useSuspenseQuery(homeQuery);

  return (
    <div className="min-h-screen bg-background pb-20 pt-20 xl:pl-18 xl:pt-6">
      <TopNav userName={data.userName} />
      <main className="px-4 sm:px-8">
        <h1 className="mb-6 text-2xl font-black tracking-tight sm:text-3xl">
          {t("continueWatching")}
        </h1>
        {data.resume.length === 0 ? (
          <p className="text-muted-foreground">{t("nothingHere")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {data.resume.map((item) => (
              <MediaCard key={item.Id} item={item} playDirect />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
