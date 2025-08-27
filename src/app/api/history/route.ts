import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/supabase";
import { DateTime } from "luxon";

type DayRow = {
  date: string;
  starting_allowance_cents: number;
  spent_cents: number;
  ending_rollover_cents: number;
};

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || "";
  if (!userId) return NextResponse.json({ error: "Missing user" }, { status: 401 });

  const days = Number(new URL(req.url).searchParams.get("days") || 30);
  const sb = admin();

  const { data: user } = await sb.from("users").select("timezone").eq("id", userId).single();
  const tz = user?.timezone || "America/New_York";

  const end = DateTime.now().setZone(tz).endOf("day");
  const start = end.minus({ days }).startOf("day");

  const { data: budget } = await sb.from("budgets")
    .select("daily_allowance_cents").eq("user_id", userId).single();
  const base = budget?.daily_allowance_cents ?? 0;

  const { data: txns } = await sb.from("transactions")
    .select("amount_cents, posted_at")
    .eq("user_id", userId)
    .gte("posted_at", start.toUTC().toISO())
    .lte("posted_at", end.toUTC().toISO());

  const buckets = new Map<string, number>();
  (txns || []).forEach(t => {
    const d = DateTime.fromISO(String(t.posted_at)).setZone(tz).toFormat("yyyy-LL-dd");
    buckets.set(d, (buckets.get(d) || 0) + (t.amount_cents || 0));
  });

  const out: DayRow[] = [];
  let rollover = 0;
  for (let i = days; i >= 0; i--) {
    const d = end.minus({ days: i }).toFormat("yyyy-LL-dd");
    const spent = Math.abs(buckets.get(d) || 0);
    const incoming = base + rollover;
    const ending = incoming - spent;
    out.push({
      date: d,
      starting_allowance_cents: incoming,
      spent_cents: spent,
      ending_rollover_cents: ending
    });
    rollover = ending;
  }

  return NextResponse.json({ days: out });
}