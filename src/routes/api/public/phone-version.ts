import { createFileRoute } from "@tanstack/react-router";
import { PHONE_RELEASE, phoneReleaseReady } from "@/lib/phone-release";
import { TV_SITE } from "@/lib/tv-release";

export const Route = createFileRoute("/api/public/phone-version")({
  server: {
    handlers: {
      GET: async () => {
        const ready = phoneReleaseReady();
        const body = {
          packageId: "app.aurora.mobile",
          available: ready,
          versionCode: ready ? PHONE_RELEASE.versionCode : 0,
          versionName: PHONE_RELEASE.versionName,
          downloadUrl: `${TV_SITE}${PHONE_RELEASE.path}`,
          sha256: ready ? PHONE_RELEASE.sha256 : "",
        };
        return new Response(JSON.stringify(body), {
          headers: { "content-type": "application/json", "cache-control": "public, max-age=300" },
        });
      },
    },
  },
});
