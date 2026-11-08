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

## Optional: Continue with Google

1. In **Google Cloud Console → APIs & Services → Credentials**, create an **OAuth client ID** of type
   *Web application*. Under *Authorized redirect URIs* add
   `https://<your-project>.supabase.co/auth/v1/callback` (Supabase shows the exact URL on the Google
   provider page).
2. In Supabase, **Authentication → Sign In / Providers → Google**: turn it on and paste the client ID
   and secret.
3. In Supabase, **Authentication → URL Configuration → Redirect URLs**: add
   `newshammer://auth-callback`.
4. In GitHub, **Settings → Secrets and variables → Actions → Variables**: add `GOOGLE_SIGN_IN` with
   the value `1`.

The next build shows **Continue with Google** on the welcome, sign-in and save screens.
