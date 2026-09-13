import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import {
  createAccountFn,
  deleteAccountFn,
  listAccountsFn,
  setExpiryFn,
  setPasswordFn,
} from "@/lib/accounts.functions";
import { getSessionFn } from "@/lib/auth.functions";
import {
  getActiveSessionsFn,
  getServerUsageFn,
  setBitrateCapFn,
} from "@/lib/jellyfin.functions";


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

function fmtTime(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

function AdminPage() {
  const list = useServerFn(listAccountsFn);
  const create = useServerFn(createAccountFn);
  const remove = useServerFn(deleteAccountFn);
  const setPassword = useServerFn(setPasswordFn);
  const setExpiry = useServerFn(setExpiryFn);

  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => list() });

  const activity = useQuery({
    queryKey: ["active-sessions"],
    queryFn: () => getActiveSessionsFn(),
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });


  const empty = { username: "", password: "", jfUsername: "", jfPassword: "", isAdmin: false, expiresAt: "" };
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

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-foreground">Live activity</h2>
            <span className="flex h-2 w-2 animate-pulse rounded-full bg-primary" />
            <span className="text-xs text-muted-foreground">updates every 5s</span>
          </div>
          {activity.isLoading && <p className="text-sm text-muted-foreground">Checking…</p>}
          {!activity.isLoading && (activity.data?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">Nobody is watching right now.</p>
          )}
          {activity.data?.map((s) => (
            <div key={s.id} className="rounded-lg bg-card px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-foreground">
                  {s.userName}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {s.device}
                    {s.client ? ` · ${s.client}` : ""}
                  </span>
                </p>
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                    !s.title
                      ? "bg-secondary text-muted-foreground"
                      : s.isPaused
                        ? "bg-secondary text-foreground"
                        : "bg-primary text-primary-foreground"
                  }`}
                >
                  {!s.title ? "idle" : s.isPaused ? "paused" : "playing"}
                </span>
              </div>
              {s.title && (
                <>
                  <p className="mt-1 text-sm text-foreground">
                    {s.title}
                    {s.subtitle ? ` — ${s.subtitle}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fmtTime(s.positionSeconds)}
                    {s.runtimeSeconds ? ` / ${fmtTime(s.runtimeSeconds)}` : ""}
                    {s.playMethod ? ` · ${s.playMethod}` : ""}
                  </p>
                  {s.runtimeSeconds ? (
                    <div className="mt-2 h-1 w-full overflow-hidden rounded bg-secondary">
                      <div
                        className="h-full bg-primary"
                        style={{
                          width: `${Math.min(100, (s.positionSeconds / s.runtimeSeconds) * 100)}%`,
                        }}
                      />
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ))}
        </div>

        <ServerUsagePanel />

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
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Access expires on</label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                className={field}
              />
              <p className="text-xs text-muted-foreground">Leave blank for no expiry.</p>
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
          {accounts.isError && (
            <p className="text-sm text-destructive">
              People could not be loaded. Refresh the page and sign in again if needed.
            </p>
          )}
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
                <p className="text-xs text-muted-foreground">
                  {a.expires_at
                    ? `${new Date(a.expires_at).getTime() <= Date.now() ? "Expired" : "Expires"} ${new Date(a.expires_at).toLocaleDateString()}`
                    : "No expiry"}
                </p>
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
                    const input = window.prompt(
                      `Expiry date for ${a.username} (YYYY-MM-DD, blank to remove)`,
                      a.expires_at ? new Date(a.expires_at).toISOString().slice(0, 10) : "",
                    );
                    if (input === null) return;
                    const res = await setExpiry({
                      data: { id: a.id, expiresAt: input.trim() ? input.trim() : null },
                    });
                    if (!res.ok) window.alert(res.error);
                    await accounts.refetch();
                  }}
                  className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-foreground hover:text-foreground"
                >
                  Set expiry
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

function mbps(bps: number) {
  return (bps / 1_000_000).toFixed(1);
}

function ServerUsagePanel() {
  const usageFn = useServerFn(getServerUsageFn);
  const setCap = useServerFn(setBitrateCapFn);
  const usage = useQuery({
    queryKey: ["server-usage"],
    queryFn: () => usageFn(),
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });
  const [draft, setDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const u = usage.data;
  const current = u ? Number(mbps(u.capBps)) : 6;
  const value = draft === "" ? String(current) : draft;

  async function save(next: number) {
    setSaving(true);
    try {
      await setCap({ data: { mbps: next } });
      setDraft("");
      await usage.refetch();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg bg-card p-6 shadow-xl">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold text-foreground">Server usage</h2>
        <span className="flex h-2 w-2 animate-pulse rounded-full bg-primary" />
        <span className="text-xs text-muted-foreground">updates every 5s</span>
      </div>

      {!u && <p className="text-sm text-muted-foreground">Checking…</p>}

      {u && (
        <>
          <p className="text-xs text-muted-foreground">
            {u.serverName}
            {u.version ? ` · v${u.version}` : ""}
            {u.os ? ` · ${u.os}` : ""}
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Streams" value={String(u.activeStreams)} />
            <Stat label="Converting (CPU)" value={String(u.transcodingStreams)} />
            <Stat label="Playing as-is" value={String(u.directStreams)} />
            <Stat label="Bandwidth" value={`${mbps(u.totalBitrate)} Mbps`} />
          </div>

          {u.streams.length > 0 && (
            <div className="space-y-2">
              {u.streams.map((s) => (
                <div key={s.id} className="rounded-md bg-secondary px-3 py-2 text-xs">
                  <p className="font-semibold text-foreground">
                    {s.userName} — {s.title}
                  </p>
                  <p className="text-muted-foreground">
                    {s.method === "Transcode" ? "Converting" : "Playing as-is"}
                    {s.bitrate ? ` · ${mbps(s.bitrate)} Mbps` : ""}
                    {s.framerate ? ` · ${Math.round(s.framerate)} fps` : ""}
                    {s.videoCodec ? ` · ${s.videoCodec}` : ""}
                    {s.audioCodec ? `/${s.audioCodec}` : ""}
                    {s.hardware ? " · hardware" : ""}
                  </p>
                  {s.reasons.length > 0 && (
                    <p className="text-muted-foreground">Why: {s.reasons.join(", ")}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 border-t border-border pt-4">
            <label className="text-sm font-medium text-foreground">
              Quality cap — currently {current} Mbps
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={40}
                step={1}
                value={value}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full accent-primary"
              />
              <span className="w-20 shrink-0 text-sm text-foreground">{value} Mbps</span>
              <button
                type="button"
                disabled={saving || Number(value) === current}
                onClick={() => save(Number(value))}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Lower it if playback keeps stalling; raise it for sharper picture. Takes effect the
              next time someone starts a title.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-secondary px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}
