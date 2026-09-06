import { createServerFn } from "@tanstack/react-start";

import { readJfSession } from "./session.server";

async function requireSession() {
  const s = await readJfSession();
  if (!s) throw new Error("Unauthorized");
  return s;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type HistoryEntry = {
  jf_item_id: string;
  title: string;
  subtitle: string | null;
  item_type: string;
  image_item_id: string | null;
  seconds_watched: number;
  last_position_seconds: number;
  runtime_seconds: number | null;
  play_count: number;
  last_played_at: string;
};

/** Add watched time for a title. Best-effort: never breaks playback. */
export const logWatchFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      itemId: string;
      title: string;
      subtitle?: string | null;
      itemType?: string;
      imageItemId?: string | null;
      secondsDelta: number;
      positionSeconds: number;
      runtimeSeconds?: number | null;
      isNewPlay?: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const s = await requireSession();
      const db = await admin();
      const { data: existing } = await db
        .from("watch_history")
        .select("seconds_watched, play_count")
        .eq("jf_user_id", s.userId)
        .eq("jf_item_id", data.itemId)
        .maybeSingle();

      const row = {
        jf_user_id: s.userId,
        jf_item_id: data.itemId,
        title: data.title,
        subtitle: data.subtitle ?? null,
        item_type: data.itemType ?? "Movie",
        image_item_id: data.imageItemId ?? data.itemId,
        seconds_watched:
          (existing?.seconds_watched ?? 0) + Math.max(0, Math.floor(data.secondsDelta)),
        last_position_seconds: Math.max(0, Math.floor(data.positionSeconds)),
        runtime_seconds: data.runtimeSeconds ? Math.floor(data.runtimeSeconds) : null,
        play_count: (existing?.play_count ?? 0) + (data.isNewPlay || !existing ? 1 : 0),
        last_played_at: new Date().toISOString(),
      };

      const { error } = await db
        .from("watch_history")
        .upsert(row, { onConflict: "jf_user_id,jf_item_id" });
      if (error) throw error;
      return { ok: true as const };
    } catch (err) {
      console.warn("watch history log failed", err);
      return { ok: false as const };
    }
  });

export const getHistoryFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<HistoryEntry[]> => {
    const s = await requireSession();
    const db = await admin();
    const { data, error } = await db
      .from("watch_history")
      .select(
        "jf_item_id, title, subtitle, item_type, image_item_id, seconds_watched, last_position_seconds, runtime_seconds, play_count, last_played_at",
      )
      .eq("jf_user_id", s.userId)
      .order("last_played_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data ?? []) as HistoryEntry[];
  },
);

export const clearHistoryFn = createServerFn({ method: "POST" }).handler(async () => {
  const s = await requireSession();
  const db = await admin();
  const { error } = await db.from("watch_history").delete().eq("jf_user_id", s.userId);
  if (error) throw error;
  return { ok: true as const };
});
