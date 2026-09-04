# Fix Aurora sign-in persistence

## Goal
Make signing in as `Johnny4091` persist across navigation and refreshes, then confirm the signed-in Aurora home and **Manage people** admin page both load.

## Plan
1. **Repair session persistence**
   - Inspect the login response cookie in both local and embedded preview contexts.
   - Replace the current one-size-fits-all cookie flags with environment-safe settings that work on HTTPS preview while remaining valid during local verification.
   - Keep the session encrypted, HTTP-only, scoped to the whole app, and long-lived.

2. **Make route authentication consistent**
   - Centralize the session read used by sign-in, home, and admin access checks.
   - Ensure a successful login waits for the session write before navigating.
   - Preserve the admin flag in the session so `Johnny4091` is recognized as an administrator.

3. **Harden account-management access**
   - Keep **Manage people** restricted to administrators.
   - Make its account-list request use the same verified session and show a clear failure instead of silently redirecting or hanging.

4. **Verify end to end**
   - Sign in with the existing `Johnny4091` account.
   - Confirm the Aurora home loads and remains signed in after refresh.
   - Open `/admin`, confirm **Manage people** and the account list render, then refresh that page to prove the session still sticks.
   - Check sign-out clears the session and returns to sign-in.

## Technical notes
- The existing account row is present, has a password hash, is linked to the `Johnny4091` media profile, and has admin access.
- No database changes are expected unless runtime verification reveals a separate account-data problem.
