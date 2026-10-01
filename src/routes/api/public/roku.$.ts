import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

import { jfBase, jfGet, jfKey, jfPost } from "@/lib/jellyfin.server";

/** Signed bearer token for the Roku channel (no cookies on Roku). */
type RokuToken = { uid: string; tok: string; name: string; exp: number };

function secret() {
  return process.env["SESSION_SECRET"] ?? "";
}
function sign(payload: RokuToken) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}
function verify(raw: string | null): RokuToken | null {
  if (!raw) return null;
  const [body, mac] = raw.replace(/^Bearer\s+/i, "").split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as RokuToken;
    return p.exp > Date.now() ? p : null;
  } catch {
    return null;
  }
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

/** Public server URL the Roku device can reach directly (raw IP is fine there). */
function deviceBase() {
  return (process.env["EMBY_SERVER_URL"] ?? process.env["JELLYFIN_SERVER_URL"] ?? "").replace(/\/$/, "");
}

type RawChannel = {
  Id: string;
  Name?: string;
  ChannelNumber?: string;
  Number?: string;
  ImageTags?: Record<string, string>;
  CurrentProgram?: { Name?: string; StartDate?: string; EndDate?: string };
};

async function login(req: Request) {
  const { username, password } = (await req.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
  };
  if (!username || !password) return json({ error: "Missing username or password" }, 400);
  const { authenticateAccount } = await import("@/lib/accounts.server");
  const auth = await authenticateAccount(username, password);
  if (!auth.ok) return json({ error: "Sign-in failed" }, 401);
  const acc = auth.account;
  let tok = "";
  let uid = acc.jfUserId ?? "";
  if (acc.jfPassword) {
    const r = await fetch(jfBase() + "/Users/AuthenticateByName", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Emby-Authorization":
          'MediaBrowser Client="Aurora Roku", Device="Roku", DeviceId="aurora-roku", Version="1.0.0"',
      },
      body: JSON.stringify({ Username: acc.jfUsername, Pw: acc.jfPassword }),
    }).catch(() => null);
    if (r?.ok) {
      const j = (await r.json()) as { AccessToken: string; User: { Id: string } };
      tok = j.AccessToken;
      uid = j.User.Id;
    }
  }
  if (!tok) {
    const users = await jfGet<{ Id: string; Name: string }[]>("/Users").catch(() => []);
    uid = users.find((u) => u.Name.toLowerCase() === acc.jfUsername.toLowerCase())?.Id ?? uid;
    tok = jfKey();
  }
  if (!uid) return json({ error: "No media profile linked" }, 403);
  return json({
    token: sign({ uid, tok, name: acc.username ?? username, exp: Date.now() + 90 * 86_400_000 }),
    name: acc.username ?? username,
  });
}

async function channels(s: RokuToken, url: URL) {
  const start = Number(url.searchParams.get("start") ?? 0);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 200);
  const res = await jfGet<{ Items?: RawChannel[]; TotalRecordCount?: number }>(
    `/LiveTv/Channels?UserId=${s.uid}&AddCurrentProgram=true&EnableImages=true&StartIndex=${start}&Limit=${limit}`,
    s.tok,
  );
  const base = deviceBase();
  return json({
    total: res.TotalRecordCount ?? 0,
    channels: (res.Items ?? []).map((c) => ({
      id: c.Id,
      name: c.Name ?? "Channel",
      number: c.ChannelNumber ?? c.Number ?? "",
      logo: c.ImageTags?.["Primary"]
        ? `${base}/Items/${c.Id}/Images/Primary?maxWidth=200&api_key=${s.tok}`
        : "",
      now: c.CurrentProgram?.Name ?? "",
      start: c.CurrentProgram?.StartDate ?? "",
      end: c.CurrentProgram?.EndDate ?? "",
    })),
  });
}

async function guide(s: RokuToken, url: URL) {
  const ids = url.searchParams.get("channelIds") ?? "";
  if (!ids) return json({ programs: [] });
  const start = new Date();
  const end = new Date(start.getTime() + 6 * 3_600_000);
  const q = new URLSearchParams({
    UserId: s.uid,
    ChannelIds: ids,
    MinEndDate: start.toISOString(),
    MaxStartDate: end.toISOString(),
    SortBy: "StartDate",
    Limit: "500",
  });
  type Raw = { Id: string; ChannelId: string; Name?: string; StartDate?: string; EndDate?: string };
  const res = await jfGet<{ Items?: Raw[] }>(`/LiveTv/Programs?${q}`, s.tok).catch(() => ({
    Items: [] as Raw[],
  }));
  return json({
    programs: (res.Items ?? []).map((p) => ({
      id: p.Id,
      channelId: p.ChannelId,
      name: p.Name ?? "",
      start: p.StartDate ?? "",
      end: p.EndDate ?? "",
    })),
  });
}

async function stream(s: RokuToken, url: URL) {
  const id = url.searchParams.get("id");
  if (!id) return json({ error: "Missing id" }, 400);
  const { getBitrateCap } = await import("@/lib/settings.server");
  const cap = await getBitrateCap();
  type PI = { MediaSources?: { TranscodingUrl?: string }[] };
  const res = await jfPost<PI>(
    `/Items/${id}/PlaybackInfo?UserId=${s.uid}&SubtitleStreamIndex=-1&MaxStreamingBitrate=${cap}`,
    {
      DeviceProfile: {
        MaxStreamingBitrate: cap,
        DirectPlayProfiles: [],
        TranscodingProfiles: [
          {
            Type: "Video",
            Container: "ts",
            Protocol: "hls",
            VideoCodec: "h264",
            AudioCodec: "aac",
            MaxAudioChannels: "2",
            Context: "Streaming",
          },
        ],
        SubtitleProfiles: [],
      },
      AutoOpenLiveStream: true,
      IsInfiniteStream: true,
    },
    s.tok,
    "aurora-roku",
  );
  let path = res?.MediaSources?.[0]?.TranscodingUrl;
  if (!path) {
    path = `/Videos/${id}/master.m3u8?MediaSourceId=${id}&VideoCodec=h264&AudioCodec=aac&MaxStreamingBitrate=${cap}`;
  }
  path = path.replace(/([?&])SubtitleMethod=[^&]*/gi, "$1").replace(/[?&]$/, "");
  const sep = path.includes("?") ? "&" : "?";
  return json({
    url: `${deviceBase()}${path}${sep}SubtitleStreamIndex=-1&SubtitleMethod=External&api_key=${s.tok}`,
  });
}

export const Route = createFileRoute("/api/public/roku/$")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (params._splat === "login") return login(request);
        return json({ error: "Not found" }, 404);
      },
      GET: async ({ request, params }) => {
        const s = verify(request.headers.get("authorization"));
        if (!s) return json({ error: "Unauthorized" }, 401);
        const url = new URL(request.url);
        try {
          if (params._splat === "channels") return await channels(s, url);
          if (params._splat === "guide") return await guide(s, url);
          if (params._splat === "stream") return await stream(s, url);
        } catch {
          return json({ error: "Media server error" }, 502);
        }
        return json({ error: "Not found" }, 404);
      },
    },
  },
});
