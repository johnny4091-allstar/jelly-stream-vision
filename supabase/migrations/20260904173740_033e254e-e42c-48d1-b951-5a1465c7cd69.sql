CREATE TABLE public.posters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jf_item_id text NOT NULL UNIQUE,
  title text NOT NULL,
  year integer,
  genres text[] NOT NULL DEFAULT '{}',
  rating text,
  cover_url text,
  item_type text NOT NULL DEFAULT 'Movie',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.posters TO anon;
GRANT SELECT ON public.posters TO authenticated;
GRANT ALL ON public.posters TO service_role;

ALTER TABLE public.posters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Posters are publicly readable" ON public.posters FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_posters_updated_at BEFORE UPDATE ON public.posters
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX posters_sort_idx ON public.posters (sort_order, title);