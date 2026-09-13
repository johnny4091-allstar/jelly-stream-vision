CREATE POLICY "No direct client access to settings"
ON public.app_settings FOR SELECT TO anon, authenticated USING (false);