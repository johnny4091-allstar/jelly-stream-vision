import { createServerFn } from "@tanstack/react-start";

import { jfGet } from "./jellyfin.server";
import { readJfSession } from "./session.server";
import type { JfItem } from "./jellyfin.types";
import type { PosterRecord } from "./posters.types";

interface PosterRow {
  jf_item_id: string;
  title: string;
  year: number | null;
  genres: string[] | null;
  rating: string | null;
  cover_url: string | null;
  item_type: string;
}

function toRecord(r: PosterRow): PosterRecord {
  return {
    jfItemId: r.jf_item_id,
    title: r.title,
    year: r.year,
    genres: r.genres ?? [],
    rating: r.rating,
    coverUrl: r.cover_url,
    itemType: r.item_type,
  };
}

/** Read the saved poster catalogue (title, year, genre, rating, cover). */
export const listPostersFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<PosterRecord[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("posters")
      .select("jf_item_id, title, year, genres, rating, cover_url, item_type")
      .order("sort_order", { ascending: true })
      .order("title", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => toRecord(r as PosterRow));
  },
);

/** Pull the signed-in user's Jellyfin library into the poster catalogue. */
export const syncPostersFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ count: number }> => {
    const s = await readJfSession();
    if (!s) throw new Error("Unauthorized");

    const res = await jfGet<{ Items: JfItem[] }>(
      `/Users/${s.userId}/Items?Recursive=true&IncludeItemTypes=Movie,Series&SortBy=SortName&SortOrder=Ascending&Limit=500&Fields=Genres,ProductionYear,OfficialRating`,
      s.token,
    );
    const items = res.Items ?? [];
    if (!items.length) return { count: 0 };

    const rows = items.map((item, idx) => ({
      jf_item_id: item.Id,
      title: item.Name,
      year: item.ProductionYear ?? null,
      genres: item.Genres ?? [],
      rating: item.OfficialRating ?? null,
      cover_url: `/api/proxy/Items/${item.Id}/Images/Primary?maxWidth=600&quality=85`,
      item_type: item.Type,
      sort_order: idx,
    }));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("posters")
      .upsert(rows, { onConflict: "jf_item_id" });
    if (error) throw new Error(error.message);
    return { count: rows.length };
  },
);
