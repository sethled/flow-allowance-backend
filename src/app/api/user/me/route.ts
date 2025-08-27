import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || "";
  if (!userId) return NextResponse.json({ error: "Missing user" }, { status: 401 });

  const sb = admin();
  const { data: user, error } = await sb.from("users")
    .select("email, plan, currency_code, timezone")
    .eq("id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    id: userId,
    email: user?.email ?? null,
    plan: user?.plan ?? "free",
    currency_code: user?.currency_code ?? "USD",
    timezone: user?.timezone ?? "America/New_York",
  });
}