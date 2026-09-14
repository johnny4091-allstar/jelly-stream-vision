import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { CalendarClock, Radio, Tv } from "lucide-react";

import { TopNav } from "@/components/TopNav";
import { getSessionFn } from "@/lib/auth.functions";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/live")({
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (!session) throw redirect({ to: "/login" });
  },
  component: LiveLayout,
});

function LiveLayout() {
  const { t } = useLanguage();
  const tab =
    "rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";
  const active = { className: `${tab} bg-primary text-primary-foreground hover:bg-primary` };

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNav userName="" />
      <div className="px-4 pt-24 sm:px-8">
        <h1 className="flex items-center gap-3 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          <Radio className="h-6 w-6 text-primary" />
          {t("liveTv")}
        </h1>
        <nav className="mt-4 flex flex-wrap gap-2">
          <Link to="/live" activeOptions={{ exact: true }} activeProps={active} className={tab}>
            <span className="inline-flex items-center gap-2">
              <Tv className="h-4 w-4" />
              {t("channels")}
            </span>
          </Link>
          <Link to="/live/guide" activeProps={active} className={tab}>
            <span className="inline-flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              {t("guide")}
            </span>
          </Link>
          <Link to="/live/recordings" activeProps={active} className={tab}>
            {t("recordings")}
          </Link>
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
