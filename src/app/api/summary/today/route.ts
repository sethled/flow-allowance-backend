import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/supabase";
import { DateTime } from "luxon";

function dayOf(tz: string, offsetDays: number) {
  return DateTime.now().setZone(tz).plus({ days: offsetDays }).toFormat("yyyy-LL-dd");
}

export const dynamic = "force-dynamic"; // avoid caching issues

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || "";
  if (!userId) return NextResponse.json({ error: "Missing user" }, { status: 401 });

  const sb = admin();

  // user timezone (fallback to a sane default)
  const { data: user } = await sb.from("users")
    .select("timezone").eq("id", userId).single();
  const tz = user?.timezone || "America/New_York";

  // compute today's window in that TZ
  const today = DateTime.now().setZone(tz);
  const day = today.toFormat("yyyy-LL-dd");
  const start = today.startOf("day").toUTC().toISO();
  const end = today.endOf("day").toUTC().toISO();

  // base allowance (current budget)
  const { data: budget } = await sb.from("budgets")
    .select("daily_allowance_cents").eq("user_id", userId).single();
  const base = budget?.daily_allowance_cents ?? 0;

  // yesterday's rollover (if cached; optional in MVP)
  const { data: yBal } = await sb.from("daily_balances")
    .select("ending_rollover_cents")
    .eq("user_id", userId)
    .eq("date", dayOf(tz, -1))
    .single();
  const rollover = yBal?.ending_rollover_cents ?? 0;

  // sum today's spend
  const { data: txns } = await sb.from("transactions")
    .select("amount_cents")
    .eq("user_id", userId)
    .gte("posted_at", start)
    .lte("posted_at", end);

  const spent = Math.abs((txns || []).reduce((s, t) => s + (t.amount_cents || 0), 0));

  return NextResponse.json({
    date: day,
    incoming_cents: base + rollover,
    spent_cents: spent,
    remaining_cents: base + rollover - spent,
  });
}