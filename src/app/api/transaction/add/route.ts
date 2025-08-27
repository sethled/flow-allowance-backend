import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/supabase";
import { ensureUser, readUserFromHeaders } from "@/app/api/_util/user";

export async function POST(req: NextRequest) {
  const { id: userId, email } = readUserFromHeaders(req.headers);
  if (!userId) return NextResponse.json({ error: "Missing user" }, { status: 401 });

  const body = await req.json();
  const amount = Number(body?.amount_dollars);
  const name = body?.name ? String(body.name) : null;
  const posted_at = body?.posted_at ? new Date(body.posted_at) : new Date();
  const currency = (body?.currency_code || "USD").toUpperCase();

  if (!Number.isFinite(amount)) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  await ensureUser(userId, email ?? null);
  const sb = admin();

  const amount_cents = -Math.round(Math.abs(amount) * 100); // spend = negative
  const { error } = await sb.from("transactions").insert({
    user_id: userId,
    source: "manual",
    amount_cents,
    currency_code: currency,
    name,
    posted_at: posted_at.toISOString()
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}