import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/supabase";
import { DateTime } from "luxon";

type DayRow = {
  date: string;
  starting_allowance_cents: number;
  spent_cents: number;
  ending_rollover_cents: number;
};

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || "";
  if (!userId) return NextResponse.json({ error: "Missing user" }, { status: 401 });

  const days = Number(new URL(req.url).searchParams.get("days") || 30);
  const sb = admin();

  // 1) User timezone
  const { data: user } = await sb.from("users")
    .select("timezone").eq("id", userId).single();
  const tz = user?.timezone || "America/New_York";

  const endLocal = DateTime.now().setZone(tz).endOf("day");
  const startLocal = endLocal.minus({ days }).startOf("day");

  // 2) Budget (base + start_date)
  const { data: budget } = await sb.from("budgets")
    .select("daily_allowance_cents, start_date")
    .eq("user_id", userId)
    .single();

  const base = budget?.daily_allowance_cents ?? 0;
  // start_date is a DATE (no time). Interpret in user's TZ at start of day.
  const budgetStartLocal = budget?.start_date
    ? DateTime.fromISO(String(budget.start_date), { zone: tz }).startOf("day")
    : null;

  // 3) Only fetch txns from the later of (requested start) and (budgetStart)
  const txStartLocal = budgetStartLocal && budgetStartLocal > startLocal
    ? budgetStartLocal
    : startLocal;

  const { data: txns } = await sb.from("transactions")
    .select("amount_cents, posted_at")
    .eq("user_id", userId)
    .gte("posted_at", txStartLocal.toUTC().toISO())
    .lte("posted_at", endLocal.toUTC().toISO());

  // Bucket txns by local day
  const buckets = new Map<string, number>();
  (txns || []).forEach(t => {
    const d = DateTime.fromISO(String(t.posted_at)).setZone(tz).toFormat("yyyy-LL-dd");
    buckets.set(d, (buckets.get(d) || 0) + (t.amount_cents || 0));
  });

  // 4) Walk day by day, clamping base to 0 before budgetStart
  const out: DayRow[] = [];
  let rollover = 0;

  for (let i = days; i >= 0; i--) {
    const dLocal = endLocal.minus({ days: i }).startOf("day");
    const dKey = dLocal.toFormat("yyyy-LL-dd");

    const beforeBudget = budgetStartLocal ? dLocal < budgetStartLocal : true;
    const dayBase = beforeBudget ? 0 : base;

    const spent = Math.abs(buckets.get(dKey) || 0);
    const incoming = dayBase + rollover;
    const ending = incoming - spent;

    out.push({
      date: dKey,
      starting_allowance_cents: incoming,
      spent_cents: spent,
      ending_rollover_cents: ending
    });

    // rollover only accrues after budget start
    rollover = beforeBudget ? 0 : ending;
  }

  return NextResponse.json({ days: out });
}