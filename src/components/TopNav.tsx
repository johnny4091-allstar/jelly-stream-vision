import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bookmark, History, LogOut, Play, Search, Users } from "lucide-react";

import { getSessionFn, logoutFn } from "@/lib/auth.functions";
import { LanguageSelect, useLanguage } from "@/lib/i18n";

export function TopNav({ userName }: { userName: string }) {
  const { t } = useLanguage();
  const session = useQuery({ queryKey: ["session"], queryFn: () => getSessionFn() });
  const navigate = useNavigate();
  const logout = useServerFn(logoutFn);

  return (
    <header className="fixed inset-x-0 top-0 z-40 bg-gradient-to-b from-background via-background/80 to-transparent">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3 sm:flex sm:justify-between sm:px-8 sm:py-4">
        <Link to="/" className="min-w-0 truncate text-lg font-black tracking-tight text-primary sm:text-2xl">
          AURORA
        </Link>
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-3">
          <Link
            to="/watchlist"
            aria-label={t("watchlist")}
             className="shrink-0 rounded-full p-1.5 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground sm:p-2"
          >
            <Bookmark className="h-5 w-5" />
          </Link>
          <Link
            to="/history"
            aria-label={t("history")}
            className="hidden shrink-0 rounded-full p-2 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground min-[480px]:block"
          >
            <History className="h-5 w-5" />
          </Link>
          <Link
            to="/search"
            aria-label={t("search")}
            className="shrink-0 rounded-full p-1.5 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground sm:p-2"
          >
            <Search className="h-5 w-5" />
          </Link>
          {session.data?.isAdmin && (
            <Link
              to="/admin"
              aria-label={t("people")}
              className="hidden shrink-0 rounded-full p-2 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground min-[480px]:block"
            >
              <Users className="h-5 w-5" />
            </Link>
          )}
          <LanguageSelect compact />
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary text-sm font-bold text-primary-foreground">
            {userName.charAt(0).toUpperCase()}
          </div>
          <button
            onClick={() =>
              void logout().then(() => {
                void navigate({ to: "/login" });
              })
            }
            aria-label={t("signOut")}
            className="shrink-0 rounded-full p-1.5 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground sm:p-2"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

export function PlayIcon() {
  return <Play className="h-5 w-5 fill-current" />;
}
