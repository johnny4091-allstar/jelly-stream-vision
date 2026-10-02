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

const HEADER_TIMEOUT_MS = 30_000;

/**
 * Fetch upstream, aborting if the media server hasn't sent response headers in
 * time. The timer is cleared once headers arrive so long bodies keep flowing.
 * The incoming request's signal is linked so abandoned requests stop upstream.
 */
async function fetchUpstream(
  target: string,
  headers: Headers,
  clientSignal: AbortSignal,
  headerTimeout: number | null,
): Promise<Response> {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  if (clientSignal.aborted) ctrl.abort();
  else clientSignal.addEventListener("abort", onAbort, { once: true });
  const timer = headerTimeout ? setTimeout(() => ctrl.abort(), headerTimeout) : null;
  try {
    return await fetch(target, { headers, signal: ctrl.signal });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

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

        // Header timeout only for playlists, segments and images; long streams
        // (e.g. /Videos/{id}/stream direct play) must never be cut off.
        const splat = params._splat ?? "";
        const isLongStream = /\/stream(?:\.[a-z0-9]+)?$/i.test(splat);
        const isShortResource =
          !isLongStream &&
          /\.(?:m3u8|ts|m4s|mp4a|aac|vtt)$/i.test(splat) || /\/Images\//i.test(splat);
        const headerTimeout = isShortResource ? HEADER_TIMEOUT_MS : null;

        let upstream: Response;
        try {
          upstream = await fetchUpstream(target, headers, request.signal, headerTimeout);
          // Emby produces HLS segments just in time. It can briefly return 404
          // when the player reaches the next segment before the encoder has
          // finished writing it (commonly around the one-minute mark). Wait for
          // that segment instead of passing the temporary miss to the player.
          const isMediaSegment = /\/(?:\d+|segment\d*)\.(?:ts|m4s)$/i.test(params._splat ?? "");
          for (
            let attempt = 0;
            isMediaSegment && (upstream.status === 404 || upstream.status >= 500) && attempt < 5;
            attempt += 1
          ) {
            await upstream.body?.cancel().catch(() => {});
            await new Promise((resolve) => setTimeout(resolve, 1000 + attempt * 500));
            if (request.signal.aborted) throw new Error("client aborted");
            upstream = await fetchUpstream(target, headers, request.signal, headerTimeout);
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

        // Missing artwork (common for Live TV channels) must not surface as a
        // server error in the app; answer with a plain empty 404 instead.
        if (/\/Images\//i.test(path) && !upstream.ok) {
          await upstream.body?.cancel().catch(() => {});
          return new Response(null, {
            status: 404,
            headers: { "cache-control": "private, max-age=300" },
          });
        }

        if (!out.has("cache-control")) out.set("cache-control", "private, max-age=3600");

        return new Response(upstream.body, { status: upstream.status, headers: out });
      },
    },
  },
});
