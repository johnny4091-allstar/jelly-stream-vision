const KEY = "stream_bitrate_cap";
export const DEFAULT_BITRATE_CAP = 6_000_000;
export const MIN_BITRATE_CAP = 1_000_000;
export const MAX_BITRATE_CAP = 120_000_000;

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Streaming ceiling Aurora asks the media server for, in bits per second. */
export async function getBitrateCap(): Promise<number> {
  try {
    const { data } = await (await db())
      .from("app_settings")
      .select("value")
      .eq("key", KEY)
      .maybeSingle();
    const v = Number(data?.value);
    return Number.isFinite(v) && v > 0 ? v : DEFAULT_BITRATE_CAP;
  } catch {
    return DEFAULT_BITRATE_CAP;
  }
}

export async function setBitrateCap(bps: number): Promise<number> {
  const clamped = Math.min(MAX_BITRATE_CAP, Math.max(MIN_BITRATE_CAP, Math.round(bps)));
  await (await db())
    .from("app_settings")
    .upsert({ key: KEY, value: clamped, updated_at: new Date().toISOString() });
  return clamped;
}
