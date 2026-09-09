import { createServerFn } from "@tanstack/react-start";
import { updateSession, clearSession } from "@tanstack/react-start/server";

import { jfBase } from "./jellyfin.server";
import { getJfSessionConfig, readJfSession, type JfSession } from "./session.server";

async function jellyfinLogin(username: string, password: string) {
  try {
    const res = await fetch(jfBase() + "/Users/AuthenticateByName", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Emby-Authorization":
          'MediaBrowser Client="Aurora", Device="Web", DeviceId="aurora-web", Version="1.0.0"',
      },
      body: JSON.stringify({ Username: username, Pw: password }),
    });
    if (!res.ok) {
      console.error(`Jellyfin login rejected: HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as { AccessToken: string; User: { Id: string; Name: string } };
  } catch (err) {
    console.error(`Jellyfin login failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/** Looks up a Jellyfin profile id by name using the server-wide API key. */
async function findJfUserId(name: string): Promise<string | null> {
  try {
    const res = await fetch(jfBase() + "/Users", {
      headers: { "X-Emby-Token": process.env["JELLYFIN_API_KEY"]! },
    });
    if (!res.ok) return null;
    const users = (await res.json()) as { Id: string; Name: string }[];
    return users.find((u) => u.Name.toLowerCase() === name.trim().toLowerCase())?.Id ?? null;
  } catch {
    return null;
  }
}

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator((data: { username: string; password: string }) => data)
  .handler(async ({ data }) => {
    const { authenticateAccount } = await import("./accounts.server");
    const auth = await authenticateAccount(data.username, data.password);
    if (!auth.ok) {
      if (auth.reason === "no_user") {
        return { ok: false as const, error: `No Aurora account named "${data.username.trim()}" exists. Check the spelling or ask the admin to create it.` };
      }
      if (auth.reason === "bad_password") {
        return { ok: false as const, error: "That password doesn't match this Aurora account." };
      }
      return { ok: false as const, error: `The account database returned an error: ${auth.detail ?? "unknown"}. Try again in a moment.` };
    }
    const account = auth.account;
    let token: string | null = null;
    let jfUserId: string | null = account.jfUserId;
    if (account.jfPassword) {
      const jf = await jellyfinLogin(account.jfUsername, account.jfPassword);
      if (jf) {
        token = jf.AccessToken;
        jfUserId = jf.User.Id;
      }
    }
    if (!token) {
      // Fall back to the server-wide key, resolving the linked profile by name.
      if (!jfUserId) jfUserId = await findJfUserId(account.jfUsername);
      if (jfUserId) token = process.env["JELLYFIN_API_KEY"] ?? null;
    }
    if (!token || !jfUserId) {
      return {
        ok: false as const,
        error: `Signed in, but the media-server profile "${account.jfUsername}" could not be reached on the Jellyfin server. Ask the admin to update it.`,
      };
    }
    const session: JfSession = {
      token,
      userId: jfUserId,
      userName: account.username,
      accountId: account.id,
      isAdmin: account.isAdmin,
    };
    await updateSession(getJfSessionConfig(), session);
    return { ok: true as const };
  });

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  await clearSession(getJfSessionConfig());
  return { ok: true as const };
});

export const getSessionFn = createServerFn({ method: "GET" }).handler(async () => {
  return await readJfSession();
});

/** True when no accounts exist yet, so the first-run setup page should be shown. */
export const needsSetupFn = createServerFn({ method: "GET" }).handler(async () => {
  const { countAccounts } = await import("./accounts.server");
  return (await countAccounts()) === 0;
});

export const createFirstAdminFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { username: string; password: string; jfUsername: string; jfPassword?: string }) => data,
  )
  .handler(async ({ data }) => {
    const { countAccounts, createAccount } = await import("./accounts.server");
    if ((await countAccounts()) > 0) {
      return { ok: false as const, error: "Setup has already been completed." };
    }
    let jfUserId: string | null = null;
    if (data.jfPassword) {
      const jf = await jellyfinLogin(data.jfUsername, data.jfPassword);
      if (jf) jfUserId = jf.User.Id;
    }
    if (!jfUserId) jfUserId = await findJfUserId(data.jfUsername);
    if (!jfUserId) {
      return { ok: false as const, error: "No profile with that name exists on the media server." };
    }
    await createAccount({
      username: data.username,
      password: data.password,
      jfUsername: data.jfUsername,
      ...(data.jfPassword ? { jfPassword: data.jfPassword } : {}),
      jfUserId,
      isAdmin: true,
    });
    return { ok: true as const };
  });

/** Creates a matching Jellyfin profile, then an Aurora account linked to it. */
export const signupFn = createServerFn({ method: "POST" })
  .inputValidator((data: { username: string; password: string }) => data)
  .handler(async ({ data }) => {
    const username = data.username.trim();
    if (!/^[A-Za-z0-9._-]{3,32}$/.test(username)) {
      return {
        ok: false as const,
        error: "Pick a name 3-32 characters long using letters, numbers, dots, dashes or underscores.",
      };
    }
    if (data.password.length < 6) {
      return { ok: false as const, error: "Password must be at least 6 characters." };
    }

    const { countAccounts, createAccount } = await import("./accounts.server");
    const key = process.env["JELLYFIN_API_KEY"]!;

    // Reuse an existing media profile with the same name, otherwise create one.
    let jfUserId = await findJfUserId(username);
    if (!jfUserId) {
      const res = await fetch(jfBase() + "/Users/New", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Emby-Token": key,
          "X-Emby-Authorization":
            'MediaBrowser Client="Aurora", Device="Web", DeviceId="aurora-web", Version="1.0.0"',
        },
        body: JSON.stringify({ Name: username, Password: data.password }),
      });
      if (!res.ok) {
        const detail = (await res.text().catch(() => "")).slice(0, 160).replace(/\s+/g, " ");
        return {
          ok: false as const,
          error: `Could not create a media-server profile for "${username}". ${detail}`.trim(),
        };
      }
      const created = (await res.json()) as { Id: string };
      jfUserId = created.Id;
    }

    // Make sure the media password matches the Aurora one.
    await fetch(jfBase() + `/Users/${jfUserId}/Password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Emby-Token": key,
        "X-Emby-Authorization":
          'MediaBrowser Client="Aurora", Device="Web", DeviceId="aurora-web", Version="1.0.0"',
      },
      body: JSON.stringify({ CurrentPw: "", NewPw: data.password, ResetPassword: false }),
    }).catch(() => null);

    const isFirst = (await countAccounts()) === 0;
    try {
      await createAccount({
        username,
        password: data.password,
        jfUsername: username,
        jfPassword: data.password,
        jfUserId,
        isAdmin: isFirst,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not create the account.";
      return {
        ok: false as const,
        error: msg.includes("duplicate") ? "That username is already taken." : msg,
      };
    }
    return { ok: true as const };
  });

