# Turning on News Hammer accounts (Supabase)

The app works without this; sign-in stays hidden until the two secrets below exist.

1. **Create a project** at https://supabase.com (free plan). Pick any name and a strong database
   password; the region nearest you is best.
2. **Create the table.** In the project, open **SQL Editor → New query**, paste the whole of
   [`schema.sql`](schema.sql) and press **Run**. It makes one `profiles` row per user, locked so each
   user can only read and change their own, plus the function behind *Delete account*.
3. **Email settings** (Authentication → Sign In / Providers → Email): leave Email enabled.
   - *Confirm email*: on by default. New users then get a link to tap before their first sign-in.
     Turn it off if you'd rather they're signed in straight away.
   - Authentication → **Emails → Reset Password**: add the line `Your code: {{ .Token }}` to the
     template. The app's *Forgot password* asks for that 6-digit code.
4. **Copy two values** from **Project Settings → API**: the **Project URL** and the
   **anon / public** key (not the `service_role` key).
5. **Add them to GitHub**: repository **Settings → Secrets and variables → Actions → New repository
   secret**, named exactly `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

The next build includes them. The anon key is meant to ship inside apps; the row-level security
policies in `schema.sql` are what keep each person's data private.
