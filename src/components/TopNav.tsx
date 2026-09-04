import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LogOut, Play, Search } from "lucide-react";

import { logoutFn } from "@/lib/auth.functions";

export function TopNav({ userName }: { userName: string }) {
  const navigate = useNavigate();
  const logout = useServerFn(logoutFn);

  return (
    <header className="fixed inset-x-0 top-0 z-40 bg-gradient-to-b from-background via-background/80 to-transparent">
      <div className="flex items-center justify-between px-4 py-4 sm:px-8">
        <Link to="/" className="text-xl font-black tracking-tight text-primary sm:text-2xl">
          AURORA
        </Link>
        <div className="flex items-center gap-3">
          <Link
            to="/search"
            aria-label="Search"
            className="rounded-full p-2 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
          >
            <Search className="h-5 w-5" />
          </Link>
          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-sm font-bold text-primary-foreground">
            {userName.charAt(0).toUpperCase()}
          </div>
          <button
            onClick={() =>
              void logout().then(() => {
                void navigate({ to: "/login" });
              })
            }
            aria-label="Sign out"
            className="rounded-full p-2 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
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
