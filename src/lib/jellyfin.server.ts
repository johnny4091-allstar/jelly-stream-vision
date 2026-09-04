export function jfBase() {
  return (process.env['JELLYFIN_SERVER_URL'] ?? "").replace(/\/$/, "");
}

export async function jfGet<T = unknown>(path: string, token?: string): Promise<T> {
  const res = await fetch(jfBase() + path, {
    headers: { "X-Emby-Token": token ?? process.env['JELLYFIN_API_KEY']! },
  });
  if (!res.ok) throw new Error(`Jellyfin ${res.status} for ${path}`);
  return res.json() as Promise<T>;
}

export async function jfPost<T = unknown>(
  path: string,
  body: unknown,
  token?: string,
): Promise<T | null> {
  const res = await fetch(jfBase() + path, {
    method: "POST",
    headers: {
      "X-Emby-Token": token ?? process.env['JELLYFIN_API_KEY']!,
      "Content-Type": "application/json",
    },
    body: body == null ? null : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Jellyfin ${res.status} for ${path}`);
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : null;
}
