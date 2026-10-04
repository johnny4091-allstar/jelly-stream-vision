import { createFileRoute } from "@tanstack/react-router";
import { TV_RELEASE, TV_SITE, tvReleaseReady } from "@/lib/tv-release";

export const Route = createFileRoute("/api/public/tv-version")({
  server: {
    handlers: {
      GET: async () => {
        const ready = tvReleaseReady();
        const body = {
          packageId: "app.aurora.tv",
          available: ready,
          versionCode: ready ? TV_RELEASE.versionCode : 0,
          versionName: TV_RELEASE.versionName,
          downloadUrl: `${TV_SITE}${TV_RELEASE.path}`,
          sha256: ready ? TV_RELEASE.sha256 : "",
        };
        return new Response(JSON.stringify(body), {
          headers: { "content-type": "application/json", "cache-control": "public, max-age=300" },
        });
      },
    },
  },
});
