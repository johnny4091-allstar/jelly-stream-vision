import { createServerFn } from "@tanstack/react-start";

import { jfBase } from "./jellyfin.server";
import { readJfSession } from "./session.server";

async function requireAdmin() {
  const s = await readJfSession();
  if (!s?.isAdmin) throw new Error("Unauthorized");
  return s;
}

async function jellyfinCheck(username: string, password: string) {
  const res = await fetch(jfBase() + "/Users/AuthenticateByName", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Emby-Authorization":
        'MediaBrowser Client="Aurora", Device="Web", DeviceId="aurora-web", Version="1.0.0"',
    },
    body: JSON.stringify({ Username: username, Pw: password }),
  });
  return res.ok;
}

export const listAccountsFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { listAccounts } = await import("./accounts.server");
  return await listAccounts();
});

async function findJfUserId(name: string): Promise<string | null> {
  try {
    const res = await fetch(jfBase() + "/Users", {
      headers: { "X-Emby-Token": jfKey() },
    });
    if (!res.ok) return null;
    const users = (await res.json()) as { Id: string; Name: string }[];
    return users.find((u) => u.Name.toLowerCase() === name.trim().toLowerCase())?.Id ?? null;
  } catch {
    return null;
  }
}

export const createAccountFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      username: string;
      password: string;
      jfUsername: string;
      jfPassword?: string;
      isAdmin: boolean;
      expiresAt?: string | null;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    if (!data.username.trim() || data.password.length < 6) {
      return { ok: false as const, error: "Username is required and password must be 6+ characters." };
    }
    if (data.jfPassword && !(await jellyfinCheck(data.jfUsername, data.jfPassword))) {
      return { ok: false as const, error: "Those media-server details were rejected by the server." };
    }
    const jfUserId = await findJfUserId(data.jfUsername);
    if (!jfUserId) {
      return { ok: false as const, error: "No profile with that name exists on the media server." };
    }
    const { createAccount } = await import("./accounts.server");
    try {
      await createAccount({ ...data, jfUserId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not create the account.";
      return {
        ok: false as const,
        error: msg.includes("duplicate") ? "That username is already taken." : msg,
      };
    }
    return { ok: true as const };
  });

export const setExpiryFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; expiresAt: string | null }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    if (data.expiresAt && Number.isNaN(new Date(data.expiresAt).getTime())) {
      return { ok: false as const, error: "That date could not be understood." };
    }
    const { setExpiry } = await import("./accounts.server");
    await setExpiry(data.id, data.expiresAt ? new Date(data.expiresAt).toISOString() : null);
    return { ok: true as const };
  });

export const deleteAccountFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const s = await requireAdmin();
    if (s.accountId === data.id) {
      return { ok: false as const, error: "You can't delete your own account." };
    }
    const { deleteAccount } = await import("./accounts.server");
    await deleteAccount(data.id);
    return { ok: true as const };
  });

export const setPasswordFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; password: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    if (data.password.length < 6) {
      return { ok: false as const, error: "Password must be at least 6 characters." };
    }
    const { setPassword } = await import("./accounts.server");
    await setPassword(data.id, data.password);
    return { ok: true as const };
  });
