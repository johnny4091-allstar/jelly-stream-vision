import { useSession } from "@tanstack/react-start/server";

export type JfSession = {
  token: string;
  userId: string;
  userName: string;
  accountId?: string;
  isAdmin?: boolean;
};

export function getJfSessionConfig() {
  return {
    password: process.env['SESSION_SECRET']!,
    name: "jf-session",
    maxAge: 60 * 60 * 24 * 30,
    cookie: {
      httpOnly: true,
      path: "/",
      sameSite: "none" as const,
      secure: true,
      partitioned: true,
    },
  };
}

export async function readJfSession(): Promise<JfSession | null> {
  const session = await useSession<JfSession>(getJfSessionConfig());
  const data = session.data as JfSession | undefined;
  return data && data.token ? data : null;
}
