import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/supabase";
import { ensureUser, readUserFromHeaders } from "@/app/api/_util/user";

export async function POST(req: NextRequest) {
  const { id: userId, email } = readUserFromHeaders(req.headers);
  if (!userId) return NextResponse.json({ error: "Missing user" }, { status: 401 });

  const body = await req.json();
  const daily = Number(body?.daily_allowance_dollars);
  const start = String(body?.start_date || "");
  const currency = (body?.currency_code || "USD").toUpperCase();

  if (!Number.isFinite(daily) || !start) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  await ensureUser(userId, email ?? null);

  const sb = admin();
  const daily_cents = Math.round(daily * 100);

  // one active budget per user for MVP
  await sb.from("budgets").delete().eq("user_id", userId);
  const { data, error } = await sb.from("budgets")
    .insert({ user_id: userId, daily_allowance_cents: daily_cents, start_date: start, currency_code: currency })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // also store currency on the user, if not set
  await sb.from("users").update({ currency_code: currency }).eq("id", userId);

  return NextResponse.json({ ok: true, budget: data });
}