import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/supabase";
import { ensureUser, readUserFromHeaders } from "@/app/api/_util/user";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { id: userId, email } = readUserFromHeaders(req.headers);
  if (!userId) return NextResponse.json({ error: "Missing user" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const currency = String((body["currency_code"] ?? "USD")).toUpperCase();
  const timezone = String(body["timezone"] ?? "America/New_York");

  const sb = admin();
  await ensureUser(userId, email ?? null);

  const { data, error } = await sb.from("users")
    .update({ currency_code: currency, timezone })
    .eq("id", userId)
    .select("email, plan, currency_code, timezone")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    user: { id: userId, email: data?.email ?? email ?? null, plan: data?.plan ?? "free", currency_code: data?.currency_code, timezone: data?.timezone }
  });
}