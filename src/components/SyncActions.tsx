import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Heart, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";

import { setFavoriteFn, setPlayedFn, setRatingFn } from "@/lib/jellyfin.functions";
import type { JfItem } from "@/lib/jellyfin.types";

const btn =
  "inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors";

export function SyncActions({ item }: { item: JfItem }) {
  const queryClient = useQueryClient();
  const setFavorite = useServerFn(setFavoriteFn);
  const setRating = useServerFn(setRatingFn);
  const setPlayed = useServerFn(setPlayedFn);

  const [favorite, setFav] = useState(item.UserData?.IsFavorite ?? false);
  const [likes, setLikes] = useState<boolean | null>(item.UserData?.Likes ?? null);
  const [played, setPlayedState] = useState(item.UserData?.Played ?? false);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await queryClient.invalidateQueries({ queryKey: ["item", item.Id] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        disabled={busy}
        aria-pressed={favorite}
        aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
        onClick={() => {
          const next = !favorite;
          setFav(next);
          void run(() => setFavorite({ data: { itemId: item.Id, favorite: next } }));
        }}
        className={`${btn} ${favorite ? "border-primary bg-primary/15 text-primary" : "text-foreground/80 hover:bg-accent"}`}
      >
        <Heart className={`h-4 w-4 ${favorite ? "fill-current" : ""}`} />
        {favorite ? "In My List" : "My List"}
      </button>

      <button
        disabled={busy}
        aria-pressed={likes === true}
        aria-label="I like this"
        onClick={() => {
          const next = likes === true ? null : true;
          setLikes(next);
          void run(() => setRating({ data: { itemId: item.Id, likes: next } }));
        }}
        className={`${btn} ${likes === true ? "border-primary bg-primary/15 text-primary" : "text-foreground/80 hover:bg-accent"}`}
      >
        <ThumbsUp className={`h-4 w-4 ${likes === true ? "fill-current" : ""}`} />
      </button>

      <button
        disabled={busy}
        aria-pressed={likes === false}
        aria-label="Not for me"
        onClick={() => {
          const next = likes === false ? null : false;
          setLikes(next);
          void run(() => setRating({ data: { itemId: item.Id, likes: next } }));
        }}
        className={`${btn} ${likes === false ? "border-primary bg-primary/15 text-primary" : "text-foreground/80 hover:bg-accent"}`}
      >
        <ThumbsDown className={`h-4 w-4 ${likes === false ? "fill-current" : ""}`} />
      </button>

      <button
        disabled={busy}
        aria-pressed={played}
        aria-label={played ? "Mark as unwatched" : "Mark as watched"}
        onClick={() => {
          const next = !played;
          setPlayedState(next);
          void run(() => setPlayed({ data: { itemId: item.Id, played: next } }));
        }}
        className={`${btn} ${played ? "border-primary bg-primary/15 text-primary" : "text-foreground/80 hover:bg-accent"}`}
      >
        <Check className="h-4 w-4" />
        {played ? "Watched" : "Mark watched"}
      </button>
    </div>
  );
}
