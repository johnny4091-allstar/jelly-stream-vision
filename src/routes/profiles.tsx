import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";

import { getSessionFn, logoutFn } from "@/lib/auth.functions";

export const Route = createFileRoute("/profiles")({
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (!session) throw redirect({ to: "/login" });
    return { session };
  },
  head: () => ({
    meta: [
      { title: "Profiles — Aurora" },
      { name: "description", content: "Choose who is watching on Aurora." },
      { property: "og:title", content: "Profiles — Aurora" },
      { property: "og:description", content: "Choose who is watching on Aurora." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilesPage,
});

function ProfilesPage() {
  const { session } = Route.useRouteContext() as {
    session: { userName: string };
  };
  const navigate = useNavigate();
  const logout = useServerFn(logoutFn);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background px-4">
      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Who's watching?
      </h1>
      <Link to="/" className="group flex flex-col items-center gap-3">
        <div className="flex h-28 w-28 items-center justify-center rounded-lg bg-primary text-4xl font-black text-primary-foreground transition-transform group-hover:scale-105 sm:h-36 sm:w-36 sm:text-5xl">
          {session.userName.charAt(0).toUpperCase()}
        </div>
        <span className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
          {session.userName}
        </span>
      </Link>
      <button
        onClick={() =>
          void logout().then(() => {
            void navigate({ to: "/login" });
          })
        }
        className="rounded-md border border-border px-6 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
      >
        Switch account
      </button>
    </div>
  );
}
