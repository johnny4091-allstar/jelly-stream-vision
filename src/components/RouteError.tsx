import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

/** Friendly error screen with retry, used when the media server or backend fails. */
export function RouteError({ reset }: ErrorComponentProps) {
  const router = useRouter();
  const qc = useQueryClient();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
      <p className="max-w-md text-muted-foreground">
        We couldn't reach the media server. Check your connection and try again.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          className="rounded-md bg-primary px-5 py-2 font-medium text-primary-foreground"
          onClick={() => {
            void qc.invalidateQueries();
            reset();
            void router.invalidate();
          }}
        >
          Try again
        </button>
        <Link to="/" className="rounded-md border border-border px-5 py-2 text-foreground">
          Go home
        </Link>
      </div>
    </div>
  );
}
