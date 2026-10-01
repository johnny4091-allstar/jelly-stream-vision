import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/get-roku-app")({
  head: () => ({
    meta: [
      { title: "Aurora for Roku — Install" },
      { name: "description", content: "Install the Aurora Roku channel and watch live TV with the guide." },
      { property: "og:title", content: "Aurora for Roku" },
      { property: "og:description", content: "Sideload the Aurora channel on your Roku and watch live TV." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GetRokuApp,
});

function GetRokuApp() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Aurora for Roku</h1>
      <p className="text-muted-foreground text-sm">
        Version 1.0.1 — Live TV channels with what's on now and up next, same as the TV app. Sign in with
        your Aurora account.
      </p>
      <a
        href="/download/aurora-roku.zip?v=1.0.1"
        download="aurora-roku.zip"
        className="bg-primary text-primary-foreground rounded-lg px-5 py-4 text-center text-base font-medium"
      >
        Download the Roku channel
      </a>
      <ol className="text-muted-foreground list-decimal space-y-2 pl-5 text-sm">
        <li>On your Roku remote press Home ×3, Up ×2, Right, Left, Right, Left, Right to turn on Developer Mode and set a password.</li>
        <li>On a computer on the same Wi-Fi, open the Roku's IP address in a browser and sign in as "rokudev".</li>
        <li>Upload the downloaded zip and press Install.</li>
        <li>Remote: OK watches, Up/Down changes channel while watching, Left/Right pages channels, * signs out.</li>
      </ol>
      <section className="mt-10">
        <h2 className="text-xl font-semibold">Roku Store artwork</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            ["icon_540x405.png", "Channel icon (FHD) 540×405"],
            ["icon_290x218.png", "Channel icon (HD) 290×218"],
            ["hero_1920x1080.png", "Hero image 1920×1080"],
            ["splash_1920x1080.png", "Splash (FHD) 1920×1080"],
            ["splash_1280x720.png", "Splash (HD) 1280×720"],
          ].map(([f, label]) => (
            <a key={f} href={`/download/roku-store/${f}`} download={f} className="rounded-lg border border-border bg-card p-3 hover:border-primary">
              <img src={`/download/roku-store/${f}`} alt={label} className="w-full rounded" loading="lazy" />
              <div className="mt-2 text-sm">{label} — Download</div>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
