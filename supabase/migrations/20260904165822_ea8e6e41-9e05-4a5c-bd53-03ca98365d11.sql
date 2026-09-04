ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS jf_user_id text;
ALTER TABLE public.app_users ALTER COLUMN jf_password_enc DROP NOT NULL;