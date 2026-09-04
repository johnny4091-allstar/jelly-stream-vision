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

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator((data: { username: string; password: string }) => data)
  .handler(async ({ data }) => {
    const { authenticateAccount } = await import("./accounts.server");
    const account = await authenticateAccount(data.username, data.password);
    if (!account) {
      return { ok: false as const, error: "Invalid username or password" };
    }
    const jf = await jellyfinLogin(account.jfUsername, account.jfPassword);
    if (!jf) {
      return {
        ok: false as const,
        error: "Your media-server login for this account is no longer valid. Ask the admin to update it.",
      };
    }
    const session: JfSession = {
      token: jf.AccessToken,
      userId: jf.User.Id,
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
    (data: { username: string; password: string; jfUsername: string; jfPassword: string }) => data,
  )
  .handler(async ({ data }) => {
    const { countAccounts, createAccount } = await import("./accounts.server");
    if ((await countAccounts()) > 0) {
      return { ok: false as const, error: "Setup has already been completed." };
    }
    const jf = await jellyfinLogin(data.jfUsername, data.jfPassword);
    if (!jf) {
      return { ok: false as const, error: "Those media-server details were rejected by the server." };
    }
    await createAccount({
      username: data.username,
      password: data.password,
      jfUsername: data.jfUsername,
      jfPassword: data.jfPassword,
      isAdmin: true,
    });
    return { ok: true as const };
  });
