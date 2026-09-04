import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import {
  createAccountFn,
  deleteAccountFn,
  listAccountsFn,
  setPasswordFn,
} from "@/lib/accounts.functions";
import { getSessionFn } from "@/lib/auth.functions";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (!session) throw redirect({ to: "/login" });
    if (!session.isAdmin) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Manage People — Aurora" },
      { name: "description", content: "Create and manage Aurora sign-in accounts." },
      { property: "og:title", content: "Manage People — Aurora" },
      { property: "og:description", content: "Create and manage Aurora sign-in accounts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const field =
  "w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40";

function AdminPage() {
  const list = useServerFn(listAccountsFn);
  const create = useServerFn(createAccountFn);
  const remove = useServerFn(deleteAccountFn);
  const setPassword = useServerFn(setPasswordFn);

  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => list() });

  const empty = { username: "", password: "", jfUsername: "", jfPassword: "", isAdmin: false };
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await create({ data: form });
      if (res.ok) {
        setForm(empty);
        await accounts.refetch();
      } else setError(res.error);
    } catch {
      setError("Could not create that person.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:px-8">
      <div className="mx-auto w-full max-w-3xl space-y-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Manage people
          </h1>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            Back to Aurora
          </Link>
        </div>

        <form onSubmit={onCreate} className="space-y-4 rounded-lg bg-card p-6 shadow-xl">
          <h2 className="text-lg font-bold text-foreground">Add a person</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Sign-in username</label>
              <input
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className={field}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Sign-in password</label>
              <input
                required
                minLength={6}
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={field}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Media-server username</label>
              <input
                required
                value={form.jfUsername}
                onChange={(e) => setForm({ ...form, jfUsername: e.target.value })}
                className={field}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Media-server password</label>
              <input
                type="text"
                value={form.jfPassword}
                onChange={(e) => setForm({ ...form, jfPassword: e.target.value })}
                className={field}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={form.isAdmin}
              onChange={(e) => setForm({ ...form, isAdmin: e.target.checked })}
              className="h-4 w-4 accent-[hsl(var(--primary))]"
            />
            Can manage people
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? "Adding…" : "Add person"}
          </button>
        </form>

        <div className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">People</h2>
          {accounts.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {accounts.data?.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-card px-4 py-3"
            >
              <div>
                <p className="font-semibold text-foreground">
                  {a.username}
                  {a.is_admin && (
                    <span className="ml-2 rounded bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                      admin
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">Media server: {a.jf_username}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const pw = window.prompt(`New password for ${a.username}`);
                    if (!pw) return;
                    const res = await setPassword({ data: { id: a.id, password: pw } });
                    if (!res.ok) window.alert(res.error);
                  }}
                  className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-foreground hover:text-foreground"
                >
                  Change password
                </button>
                <button
                  onClick={async () => {
                    if (!window.confirm(`Remove ${a.username}?`)) return;
                    const res = await remove({ data: { id: a.id } });
                    if (!res.ok) window.alert(res.error);
                    await accounts.refetch();
                  }}
                  className="rounded-md border border-border px-3 py-1.5 text-xs text-destructive hover:border-destructive"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
