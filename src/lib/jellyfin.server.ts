/** Server-wide API key (Emby first, legacy Jellyfin value as fallback). */
export function jfKey() {
  return process.env['EMBY_API_KEY'] ?? process.env['JELLYFIN_API_KEY'] ?? "";
}

export function jfBase() {
  const raw = (process.env['EMBY_SERVER_URL'] ?? process.env['JELLYFIN_SERVER_URL'] ?? "").replace(
    /\/$/,
    "",
  );
  // Cloudflare Workers refuse outbound fetches to bare IP addresses (error 1003),
  // so map the IP to an equivalent hostname that resolves to it.
  return raw.replace(
    /^(https?:\/\/)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?=[:/]|$)/,
    (_m, proto, a, b, c, d) => `${proto}${a}-${b}-${c}-${d}.nip.io`,
  );
}

function jfHeaders(token?: string, deviceId?: string): Record<string, string> {
  return {
    "X-Emby-Token": token ?? jfKey(),
    "X-Emby-Authorization": `MediaBrowser Client="Aurora", Device="Web", DeviceId="${deviceId ?? "aurora-web"}", Version="1.0.0"`,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    Accept: "application/json",
  };
}

export async function jfGet<T = unknown>(path: string, token?: string): Promise<T> {
  const res = await fetch(jfBase() + path, { headers: jfHeaders(token) });
  if (!res.ok) {
    const snippet = (await res.text().catch(() => "")).slice(0, 200).replace(/\s+/g, " ");
    const server = res.headers.get("server") ?? "";
    throw new Error(`Jellyfin ${res.status} for ${path} [server=${server}] ${snippet}`);
  }
  return res.json() as Promise<T>;
}

export async function jfPost<T = unknown>(
  path: string,
  body: unknown,
  token?: string,
  deviceId?: string,
): Promise<T | null> {
  const res = await fetch(jfBase() + path, {
    method: "POST",
    headers: { ...jfHeaders(token, deviceId), "Content-Type": "application/json" },
    body: body == null ? null : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Jellyfin ${res.status} for ${path}`);
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : null;
}

export async function jfDelete<T = unknown>(
  path: string,
  token?: string,
  deviceId?: string,
): Promise<T | null> {
  const res = await fetch(jfBase() + path, { method: "DELETE", headers: jfHeaders(token, deviceId) });
  if (!res.ok) throw new Error(`Jellyfin ${res.status} for ${path}`);
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : null;
}
