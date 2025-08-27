import { admin } from "@/lib/supabase";

export async function ensureUser(id: string, email: string | null) {
  const sb = admin();
  const { data } = await sb.from("users").select("id").eq("id", id).single();
  if (!data) {
    await sb.from("users").insert({ id, email });
  }
}

export function readUserFromHeaders(headers: Headers) {
  const id = headers.get("x-user-id") || "";
  const email = headers.get("x-user-email");
  return { id, email };
}