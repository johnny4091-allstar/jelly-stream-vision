import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { getSessionFn, loginFn, needsSetupFn } from "@/lib/auth.functions";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    if (await needsSetupFn()) throw redirect({ to: "/setup" });
    const session = await getSessionFn();
    if (session) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Sign In — Aurora" },
      { name: "description", content: "Sign in to your Aurora media library." },
      { property: "og:title", content: "Sign In — Aurora" },
      { property: "og:description", content: "Sign in to your Aurora media library." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const login = useServerFn(loginFn);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await login({ data: { username, password } });
      if (res.ok) {
        window.location.assign("/");
      } else {
        setError(res.error);
      }
    } catch {
      setError("Could not reach the media server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-black tracking-tight text-primary">AURORA</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with your media server account
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 rounded-lg bg-card p-6 shadow-xl">
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium text-foreground">
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
