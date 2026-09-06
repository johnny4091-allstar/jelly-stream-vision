CREATE TABLE public.watch_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jf_user_id text NOT NULL,
  jf_item_id text NOT NULL,
  title text NOT NULL,
  subtitle text,
  item_type text NOT NULL DEFAULT 'Movie',
  image_item_id text,
  seconds_watched integer NOT NULL DEFAULT 0,
  last_position_seconds integer NOT NULL DEFAULT 0,
  runtime_seconds integer,
  play_count integer NOT NULL DEFAULT 1,
  last_played_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (jf_user_id, jf_item_id)
);
GRANT ALL ON public.watch_history TO service_role;
ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.watch_history FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX watch_history_user_time ON public.watch_history (jf_user_id, last_played_at DESC);