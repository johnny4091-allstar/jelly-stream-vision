import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

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
  const [countdown, setCountdown] = useState(4);

  // Auto-start the APK download, then send the user into the live Aurora site
  // so the flow never dead-ends on a Chrome warning.
  useEffect(() => {
    const dl = window.setTimeout(() => {
      const a = document.createElement("a");
      a.href = "/download/aurora.apk";
      a.download = "aurora.apk";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }, 400);

    const tick = window.setInterval(
      () => setCountdown((c) => (c > 0 ? c - 1 : 0)),
      1000,
    );
    const go = window.setTimeout(() => {
      window.location.href = "/";
    }, 4500);

    return () => {
      window.clearTimeout(dl);
      window.clearInterval(tick);
      window.clearTimeout(go);
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Aurora for Android</h1>
      <p className="text-muted-foreground text-sm">
        Version 1.1.0. Your download started automatically. If Chrome shows a
        warning, choose “Download anyway”. Taking you to Aurora in {countdown}…
      </p>


      <a
        href="/"
        className="bg-primary text-primary-foreground rounded-lg px-5 py-4 text-center text-base font-medium"
      >
        Open Aurora now
      </a>

      <a
        href="/download/aurora.apk"
        download="aurora.apk"
        className="border-border text-foreground rounded-lg border px-5 py-4 text-center text-base font-medium"
      >
        Download again (v1.1.0 · 4.1 MB)
      </a>

      <ol className="text-muted-foreground list-decimal space-y-2 pl-5 text-sm">
        <li>Download starts by itself. If a warning appears, choose “Download anyway”.</li>
        <li>Open the downloaded file from the notification or Downloads.</li>
        <li>Allow “install unknown apps” for Chrome or Files, then Install.</li>
        <li>Open Aurora from your home screen and sign in.</li>
      </ol>

      <p className="text-muted-foreground text-xs">
        Already installed or prefer the browser? You’re being sent to the live
        Aurora site automatically.
      </p>
    </main>
  );
}
