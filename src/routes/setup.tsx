import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { createFirstAdminFn, needsSetupFn } from "@/lib/auth.functions";

export const Route = createFileRoute("/setup")({
  beforeLoad: async () => {
    const needs = await needsSetupFn();
    if (!needs) throw redirect({ to: "/login" });
  },
  head: () => ({
    meta: [
      { title: "First-time Setup — Aurora" },
      { name: "description", content: "Create the first Aurora admin account." },
      { property: "og:title", content: "First-time Setup — Aurora" },
      { property: "og:description", content: "Create the first Aurora admin account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SetupPage,
});

const field =
  "w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40";

function SetupPage() {
  const navigate = useNavigate();
  const create = useServerFn(createFirstAdminFn);
  const [form, setForm] = useState({
    username: "",
    password: "",
    jfUsername: "",
    jfPassword: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await create({ data: form });
      if (res.ok) void navigate({ to: "/login" });
      else setError(res.error);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-black tracking-tight text-primary">AURORA</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create your admin account to get started
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 rounded-lg bg-card p-6 shadow-xl">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Your sign-in username</label>
            <input required value={form.username} onChange={set("username")} className={field} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Your sign-in password</label>
            <input
              required
              type="password"
              minLength={6}
              value={form.password}
              onChange={set("password")}
              className={field}
            />
          </div>
          <div className="border-t border-border pt-4 text-xs text-muted-foreground">
            Your media-server login (used to fetch and play your library)
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Media-server username</label>
            <input required value={form.jfUsername} onChange={set("jfUsername")} className={field} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Media-server password (optional)
            </label>
            <input
              type="password"
              value={form.jfPassword}
              onChange={set("jfPassword")}
              className={field}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create admin account"}
          </button>
        </form>
      </div>
    </div>
  );
}
