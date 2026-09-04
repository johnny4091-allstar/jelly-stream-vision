import { decryptSecret, encryptSecret, hashPassword, verifyPassword } from "./crypto.server";

export type AppUserRow = {
  id: string;
  username: string;
  password_hash: string;
  jf_username: string;
  jf_password_enc: string | null;
  jf_user_id: string | null;
  is_admin: boolean;
  created_at: string;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function countAccounts(): Promise<number> {
  const db = await admin();
  const { count, error } = await db
    .from("app_users")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

export async function listAccounts() {
  const db = await admin();
  const { data, error } = await db
    .from("app_users")
    .select("id, username, jf_username, is_admin, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Pick<
    AppUserRow,
    "id" | "username" | "jf_username" | "is_admin" | "created_at"
  >[];
}

export async function createAccount(input: {
  username: string;
  password: string;
  jfUsername: string;
  jfPassword?: string;
  jfUserId?: string;
  isAdmin: boolean;
}) {
  const db = await admin();
  const { error } = await db.from("app_users").insert({
    username: input.username.trim(),
    password_hash: await hashPassword(input.password),
    jf_username: input.jfUsername.trim(),
    jf_password_enc: input.jfPassword ? await encryptSecret(input.jfPassword) : null,
    jf_user_id: input.jfUserId ?? null,
    is_admin: input.isAdmin,
  });
  if (error) throw new Error(error.message);
}

export async function deleteAccount(id: string) {
  const db = await admin();
  const { error } = await db.from("app_users").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setPassword(id: string, password: string) {
  const db = await admin();
  const { error } = await db
    .from("app_users")
    .update({ password_hash: await hashPassword(password) })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Returns the account plus its decrypted media-server credentials when the password matches. */
export async function authenticateAccount(username: string, password: string) {
  const db = await admin();
  const { data, error } = await db
    .from("app_users")
    .select("*")
    .ilike("username", username.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as AppUserRow | null;
  if (!row) return null;
  if (!(await verifyPassword(password, row.password_hash))) return null;
  return {
    id: row.id,
    username: row.username,
    isAdmin: row.is_admin,
    jfUsername: row.jf_username,
    jfUserId: row.jf_user_id,
    jfPassword: row.jf_password_enc ? await decryptSecret(row.jf_password_enc) : null,
  };
}
