import { createFileRoute } from "@tanstack/react-router";

import { jfBase } from "@/lib/jellyfin.server";
import { readJfSession } from "@/lib/session.server";

const PASS_HEADERS = [
  "content-type",
  "content-length",
  "accept-ranges",
  "content-range",
  "cache-control",
  "content-language",
];

export const Route = createFileRoute("/api/proxy/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await readJfSession();
        if (!session) return new Response("Unauthorized", { status: 401 });

        const url = new URL(request.url);
        const target = jfBase() + "/" + params._splat + url.search;

        const headers = new Headers();
        headers.set("X-Emby-Token", session.token);
        const range = request.headers.get("range");
        if (range) headers.set("Range", range);

        let upstream: Response;
        try {
          upstream = await fetch(target, { headers });
        } catch {
          return new Response("Jellyfin unreachable", { status: 502 });
        }

        const out = new Headers();
        for (const name of PASS_HEADERS) {
          const v = upstream.headers.get(name);
          if (v) out.set(name, v);
        }
        if (!out.has("cache-control")) out.set("cache-control", "private, max-age=3600");

        return new Response(upstream.body, { status: upstream.status, headers: out });
      },
    },
  },
});
