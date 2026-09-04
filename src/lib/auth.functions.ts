import { createServerFn } from "@tanstack/react-start";
import { updateSession, clearSession } from "@tanstack/react-start/server";

import { jfBase } from "./jellyfin.server";
import { getJfSessionConfig, readJfSession, type JfSession } from "./session.server";

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator((data: { username: string; password: string }) => data)
  .handler(async ({ data }) => {
    const res = await fetch(jfBase() + "/Users/AuthenticateByName", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Emby-Authorization":
          'MediaBrowser Client="Aurora", Device="Web", DeviceId="aurora-web", Version="1.0.0"',
      },
      body: JSON.stringify({ Username: data.username, Pw: data.password }),
    });
    if (!res.ok) {
      return { ok: false as const, error: "Invalid username or password" };
    }
    const json = (await res.json()) as {
      AccessToken: string;
      User: { Id: string; Name: string };
    };
    const session: JfSession = {
      token: json.AccessToken,
      userId: json.User.Id,
      userName: json.User.Name,
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
