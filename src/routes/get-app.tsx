import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/get-app")({
  head: () => ({
    meta: [
      { title: "Get the Aurora Android App" },
      {
        name: "description",
        content:
          "Download and install the Aurora Android app to stream your library on your phone or tablet.",
      },
      { property: "og:title", content: "Get the Aurora Android App" },
      {
        property: "og:description",
        content: "Download and install Aurora for Android.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GetApp,
});

function GetApp() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Aurora for Android</h1>
      <p className="text-muted-foreground text-sm">
        Tap the button below on your phone. When Chrome asks, choose “Download
        anyway”, then open the file and allow installing from this source.
      </p>

      <a
        href="/download/aurora.apk"
        download="aurora.apk"
        className="bg-primary text-primary-foreground rounded-lg px-5 py-4 text-center text-base font-medium"
      >
        Download Aurora (3.6 MB)
      </a>

      <ol className="text-muted-foreground list-decimal space-y-2 pl-5 text-sm">
        <li>Tap Download. If a warning appears, choose “Download anyway”.</li>
        <li>Open the downloaded file from the notification or Downloads.</li>
        <li>Allow “install unknown apps” for Chrome or Files, then Install.</li>
        <li>Open Aurora from your home screen and sign in.</li>
      </ol>

      <p className="text-muted-foreground text-xs">
        If nothing happens, you may be inside another app’s browser. Open this
        page in Chrome and try again.
      </p>
    </main>
  );
}
