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
          // Emby occasionally 5xxs the first segment while the encoder is still
          // spinning up; one retry turns that into a normal start instead of a
          // dead player.
          if (upstream.status >= 500 && /\.(ts|m4s|mp4)$/i.test(params._splat ?? "")) {
            await new Promise((r) => setTimeout(r, 1500));
            upstream = await fetch(target, { headers });
          }
        } catch {
          return new Response("Jellyfin unreachable", { status: 502 });
        }

        const out = new Headers();
        for (const name of PASS_HEADERS) {
          const v = upstream.headers.get(name);
          if (v) out.set(name, v);
        }
        // Playlists must never be cached, or the player replays a stale segment list and stalls.
        const path = params._splat ?? "";
        if (/\.m3u8$/i.test(path)) {
          out.set("cache-control", "no-store");
          out.set("content-type", "application/vnd.apple.mpegurl");
          out.delete("content-length");
          // Emby writes `#EXTINF:3.0000, nodesc` and relative URIs whose only
          // parameter is PlaySessionId. Stripped of the encoding parameters the
          // server rejects or slow-starts those segments, so carry the parent
          // playlist's query across to every child URI.
          const dir = path.replace(/[^/]*$/, "");
          const parentParams = new URLSearchParams(url.search);
          const withParentParams = (uri: string) => {
            const [p, q = ""] = uri.split("?");
            const merged = new URLSearchParams(parentParams);
            for (const [k, v] of new URLSearchParams(q)) {
              if (v) merged.set(k, v);
            }
            return `${p}?${merged.toString()}`;
          };
          const body = (await upstream.text())
            .split("\n")
            .map((line) => {
              const l = line.trim();
              if (l.startsWith("#EXTINF:")) {
                const dur = l.slice("#EXTINF:".length).split(",")[0]?.trim() ?? "";
                return `#EXTINF:${dur},`;
              }
              if (!l || l.startsWith("#")) return l;
              if (/^https?:\/\//i.test(l)) return l;
              if (l.startsWith("/")) return `/api/proxy${withParentParams(l)}`;
              return `/api/proxy/${dir}${withParentParams(l)}`;
            })
            .join("\n");
          return new Response(body, { status: upstream.status, headers: out });
        }

        if (!out.has("cache-control")) out.set("cache-control", "private, max-age=3600");

        return new Response(upstream.body, { status: upstream.status, headers: out });
      },
    },
  },
});
