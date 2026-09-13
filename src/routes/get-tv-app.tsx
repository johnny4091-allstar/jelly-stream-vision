import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/get-tv-app")({
  head: () => ({
    meta: [
      { title: "Aurora for Android TV — Install" },
      {
        name: "description",
        content:
          "Install Aurora on Android TV or Google TV and stream your library with the remote.",
      },
      { property: "og:title", content: "Aurora for Android TV" },
      {
        property: "og:description",
        content: "Sideload the Aurora TV app on Android TV or Google TV.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GetTvApp,
});

function GetTvApp() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Aurora for Android TV</h1>
      <p className="text-muted-foreground text-sm">
        Version 1.0.0 — a separate TV app that shows up in your Android TV or
        Google TV launcher and works with the remote.
      </p>

      <a
        href="/download/aurora-tv.apk"
        download="aurora-tv.apk"
        className="bg-primary text-primary-foreground rounded-lg px-5 py-4 text-center text-base font-medium"
      >
        Download the TV app
      </a>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Install with the Downloader app</h2>
        <ol className="text-muted-foreground list-decimal space-y-2 pl-5 text-sm">
          <li>On your TV, install “Downloader by AFTVnews” from the app store.</li>
          <li>
            In Settings, allow the Downloader app to install unknown apps.
          </li>
          <li>
            Open Downloader and enter this address:
            <br />
            <code className="text-foreground break-all">
              jelly-stream-vision.lovable.app/download/aurora-tv.apk
            </code>
          </li>
          <li>Choose Install when it finishes, then open Aurora from the home screen.</li>
        </ol>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Install from a USB stick</h2>
        <ol className="text-muted-foreground list-decimal space-y-2 pl-5 text-sm">
          <li>Download the file on a computer and copy it to a USB stick.</li>
          <li>Plug the stick into the TV and open it with a file manager app.</li>
          <li>Select the file, allow unknown apps if asked, then Install.</li>
        </ol>
      </section>

      <p className="text-muted-foreground text-xs">
        The TV app is signed for personal installs, so your TV will warn about
        an unknown source. Phones and tablets should use the regular app on the
        install page instead.
      </p>

      <a href="/" className="border-border rounded-lg border px-5 py-4 text-center text-base font-medium">
        Open Aurora in the browser
      </a>
    </main>
  );
}
