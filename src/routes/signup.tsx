import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { getSessionFn, loginFn, signupFn } from "@/lib/auth.functions";

export const Route = createFileRoute("/signup")({
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (session) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Create Account — Aurora" },
      { name: "description", content: "Create your Aurora account and media profile in one step." },
      { property: "og:title", content: "Create Account — Aurora" },
      {
        property: "og:description",
        content: "Create your Aurora account and media profile in one step.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignupPage,
});

const field =
  "w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40";

function SignupPage() {
  const signup = useServerFn(signupFn);
  const login = useServerFn(loginFn);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const res = await signup({ data: { username, password } });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const signedIn = await login({ data: { username, password } });
      if (signedIn.ok) window.location.replace("/");
      else setError(signedIn.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
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
            Create your account — a matching media profile is made for you
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 rounded-lg bg-card p-6 shadow-xl">
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium text-foreground">
              Username
            </label>
            <input
              id="username"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={field}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={field}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="confirm" className="text-sm font-medium text-foreground">
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={field}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create account"}
          </button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
