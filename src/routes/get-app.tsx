import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Download, Share, SquarePlus } from "lucide-react";
import { LEGACY_PHONE_APK, PHONE_RELEASE, phoneReleaseReady } from "@/lib/phone-release";

export const Route = createFileRoute("/get-app")({
  head: () => ({
    meta: [
      { title: "Get the Aurora App" },
      {
        name: "description",
        content:
          "Install Aurora on your Android phone, iPhone or iPad to stream your library from your home screen.",
      },
      { property: "og:title", content: "Get the Aurora App" },
      {
        property: "og:description",
        content: "Install Aurora on Android, iPhone and iPad.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GetApp,
});

type Platform = "android" | "ios" | "other";

/** Chrome's install event; not in the DOM typings yet. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  // iPadOS reports itself as a Mac; touch support gives it away.
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) {
    return "ios";
  }
  return "other";
}

function isInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    /Aurora(Mobile|TV)\//.test(navigator.userAgent)
  );
}

const apk = phoneReleaseReady()
  ? { href: PHONE_RELEASE.path, file: "aurora.apk", version: PHONE_RELEASE.versionName }
  : { href: LEGACY_PHONE_APK.path, file: "aurora.apk", version: LEGACY_PHONE_APK.versionName };

function startApkDownload() {
  const a = document.createElement("a");
  a.href = apk.href;
  a.download = apk.file;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function GetApp() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [installed, setInstalled] = useState(false);
  const [countdown, setCountdown] = useState(4);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(isInstalled());

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  // Android: auto-start the APK download, then send the user into the live Aurora site
  // so the flow never dead-ends on a Chrome warning.
  useEffect(() => {
    if (platform !== "android" || installed) return;
    const dl = window.setTimeout(startApkDownload, 400);
    const tick = window.setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    const go = window.setTimeout(() => {
      window.location.href = "/";
    }, 4500);

    return () => {
      window.clearTimeout(dl);
      window.clearInterval(tick);
      window.clearTimeout(go);
    };
  }, [platform, installed]);

  if (platform === null) {
    return <main className="min-h-screen bg-background" />;
  }

  if (installed) {
    return (
      <Shell title="You're all set">
        <p className="text-muted-foreground text-sm">Aurora is already installed on this device.</p>
        <PrimaryLink href="/">Open Aurora</PrimaryLink>
      </Shell>
    );
  }

  return (
    <Shell title={platform === "ios" ? "Aurora for iPhone & iPad" : "Get the Aurora app"}>
      {platform === "android" ? (
        <p className="text-muted-foreground text-sm">
          Version {apk.version}. Your download started automatically. If Chrome shows a warning,
          choose “Download anyway”. Taking you to Aurora in {countdown}…
        </p>
      ) : null}

      {platform === "android" ? <AndroidSection installPrompt={installPrompt} /> : null}
      {platform === "ios" ? <IosSection /> : null}
      {platform === "other" ? (
        <>
          <p className="text-muted-foreground text-sm">
            Open this page on your phone or tablet to install Aurora, or use the steps below.
          </p>
          <AndroidSection installPrompt={installPrompt} heading />
          <IosSection heading />
        </>
      ) : null}

      {platform !== "android" ? (
        <a
          href="/"
          className="text-muted-foreground text-center text-sm underline-offset-4 hover:underline"
        >
          Continue in the browser
        </a>
      ) : (
        <p className="text-muted-foreground text-xs">
          Already installed or prefer the browser? You’re being sent to the live Aurora site
          automatically.
        </p>
      )}
    </Shell>
  );
}

function AndroidSection({
  installPrompt,
  heading,
}: {
  installPrompt: InstallPromptEvent | null;
  heading?: boolean;
}) {
  return (
    <section className="flex flex-col gap-4">
      {heading ? <h2 className="text-lg font-semibold">Android phone or tablet</h2> : null}
      <a
        href={apk.href}
        download={apk.file}
        className="bg-primary text-primary-foreground flex items-center justify-center gap-2 rounded-lg px-5 py-4 text-center text-base font-medium"
      >
        <Download className="h-5 w-5" />
        Download for Android (v{apk.version})
      </a>
      {installPrompt ? (
        <button
          onClick={() => void installPrompt.prompt()}
          className="border-border text-foreground rounded-lg border px-5 py-4 text-center text-base font-medium"
        >
          Or add Aurora to your home screen
        </button>
      ) : null}
      <ol className="text-muted-foreground list-decimal space-y-2 pl-5 text-sm">
        <li>If a warning appears, choose “Download anyway”.</li>
        <li>Open the downloaded file from the notification or Downloads.</li>
        <li>Allow “install unknown apps” for Chrome or Files, then Install.</li>
        <li>Open Aurora from your home screen and sign in.</li>
      </ol>
    </section>
  );
}

function IosSection({ heading }: { heading?: boolean }) {
  return (
    <section className="flex flex-col gap-4">
      {heading ? <h2 className="text-lg font-semibold">iPhone or iPad</h2> : null}
      <p className="text-muted-foreground text-sm">
        Add Aurora to your Home Screen. It opens full screen like any other app, no App Store
        needed.
      </p>
      <ol className="flex flex-col gap-3 text-sm">
        <Step n={1}>
          Open this page in <strong>Safari</strong>.
        </Step>
        <Step n={2}>
          Tap the Share button{" "}
          <Share className="inline h-4 w-4 align-text-bottom" aria-label="Share" /> in the toolbar.
        </Step>
        <Step n={3}>
          Scroll down and tap <strong>Add to Home Screen</strong>{" "}
          <SquarePlus className="inline h-4 w-4 align-text-bottom" aria-hidden />.
        </Step>
        <Step n={4}>Tap Add, then open Aurora from your Home Screen and sign in.</Step>
      </ol>
    </section>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="bg-primary text-primary-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
        {n}
      </span>
      <span className="text-foreground/90">{children}</span>
    </li>
  );
}

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-16 pt-[max(4rem,env(safe-area-inset-top))] pb-[max(4rem,env(safe-area-inset-bottom))]">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      {children}
    </main>
  );
}

function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="bg-primary text-primary-foreground rounded-lg px-5 py-4 text-center text-base font-medium"
    >
      {children}
    </a>
  );
}
