import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bookmark, History, Home, LogOut, Play, Radio, RefreshCw, Search, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";

import { getSessionFn, logoutFn } from "@/lib/auth.functions";
import { LanguageSelect, useLanguage } from "@/lib/i18n";

type NavItem = { to: string; label: string; icon: LucideIcon; hideOnPhone?: boolean };

export function TopNav({ userName }: { userName: string }) {
  const { t } = useLanguage();
  const session = useQuery({ queryKey: ["session"], queryFn: () => getSessionFn() });
  const navigate = useNavigate();
  const logout = useServerFn(logoutFn);
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  async function syncNow() {
    if (syncing) return;
    setSyncing(true);
    try {
      await queryClient.invalidateQueries();
      await queryClient.refetchQueries({ type: "active" });
    } finally {
      setSyncing(false);
    }
  }

  const items: NavItem[] = [
    { to: "/", label: "Home", icon: Home },
    { to: "/live", label: t("liveTv"), icon: Radio },
    { to: "/watchlist", label: t("watchlist"), icon: Bookmark },
    { to: "/history", label: t("history"), icon: History, hideOnPhone: true },
    { to: "/search", label: t("search"), icon: Search },
    ...(session.data?.isAdmin
      ? [{ to: "/admin", label: t("people"), icon: Users, hideOnPhone: true } as NavItem]
      : []),
  ];

  const signOut = () =>
    void logout().then(() => {
      void navigate({ to: "/login" });
    });

  return (
    <>
      {/* Hulu-style left rail on TV / desktop: icons that expand into labels. */}
      <nav
        aria-label="Main"
        className="group/rail fixed inset-y-0 left-0 z-50 hidden w-18 flex-col justify-between overflow-hidden border-r border-border bg-sidebar/95 py-6 backdrop-blur-sm transition-[width] duration-300 hover:w-60 focus-within:w-60 xl:flex"
      >
        <div className="flex flex-col gap-1">
          <Link
            to="/"
            className="mb-6 flex items-center gap-3 px-5 text-2xl font-black tracking-tight text-primary"
          >
            <span>A</span>
            <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100">
              URORA
            </span>
          </Link>
          {items.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              aria-label={label}
              activeOptions={{ exact: to === "/" }}
              activeProps={{ className: "bg-accent text-foreground" }}
              className="mx-2 flex items-center gap-4 rounded-md px-3 py-3 text-foreground/70 transition-colors hover:bg-accent hover:text-foreground [&.active]:text-primary"
            >
              <Icon className="h-6 w-6 shrink-0" />
              <span className="whitespace-nowrap text-base font-medium opacity-0 transition-opacity duration-200 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100">
                {label}
              </span>
            </Link>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <button
            onClick={() => void syncNow()}
            disabled={syncing}
            aria-label="Sync progress"
            className="mx-2 flex items-center gap-4 rounded-md px-3 py-3 text-foreground/70 transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
          >
            <RefreshCw className={`h-6 w-6 shrink-0 ${syncing ? "animate-spin" : ""}`} />
            <span className="whitespace-nowrap text-base font-medium opacity-0 transition-opacity duration-200 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100">
              Sync
            </span>
          </button>
          <div className="mx-2 flex items-center gap-4 px-3 py-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary text-sm font-bold text-primary-foreground">
              {userName.charAt(0).toUpperCase()}
            </span>
            <span className="truncate text-base font-medium opacity-0 transition-opacity duration-200 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100">
              {userName}
            </span>
          </div>
          <div className="mx-2 px-1 opacity-0 transition-opacity duration-200 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100">
            <LanguageSelect compact />
          </div>
          <button
            onClick={signOut}
            aria-label={t("signOut")}
            className="mx-2 flex items-center gap-4 rounded-md px-3 py-3 text-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
          >
            <LogOut className="h-6 w-6 shrink-0" />
            <span className="whitespace-nowrap text-base font-medium opacity-0 transition-opacity duration-200 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100">
              {t("signOut")}
            </span>
          </button>
        </div>
      </nav>

      {/* Phone / tablet: top bar */}
      <header className="fixed inset-x-0 top-0 z-40 bg-gradient-to-b from-background via-background/80 to-transparent xl:hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3 sm:flex sm:justify-between sm:px-8 sm:py-4">
          <Link
            to="/"
            className="min-w-0 truncate text-lg font-black tracking-tight text-primary sm:text-2xl"
          >
            AURORA
          </Link>
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-3">
            {items
              .filter((i) => i.to !== "/")
              .map(({ to, label, icon: Icon, hideOnPhone }) => (
                <Link
                  key={to}
                  to={to}
                  aria-label={label}
                  className={`shrink-0 rounded-full p-1.5 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground sm:p-2 ${
                    hideOnPhone ? "hidden min-[480px]:block" : ""
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </Link>
              ))}
            <button
              onClick={() => void syncNow()}
              disabled={syncing}
              aria-label="Sync progress"
              className="shrink-0 rounded-full p-1.5 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60 sm:p-2"
            >
              <RefreshCw className={`h-5 w-5 ${syncing ? "animate-spin" : ""}`} />
            </button>
            <LanguageSelect compact />
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary text-sm font-bold text-primary-foreground">
              {userName.charAt(0).toUpperCase()}
            </div>
            <button
              onClick={signOut}
              aria-label={t("signOut")}
              className="shrink-0 rounded-full p-1.5 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground sm:p-2"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>
    </>
  );
}

export function PlayIcon() {
  return <Play className="h-5 w-5 fill-current" />;
}
