import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

function b64ToBuf(b64: string) {
  return Buffer.from(b64.replace(/^base64:/, ""), "base64");
}

function hmacHex(secretB64: string, payload: string) {
  const key = b64ToBuf(secretB64);
  return crypto.createHmac("sha256", key).update(payload).digest("hex");
}

function timingSafeEqualHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  const aBuf = Buffer.from(a, "hex");
  const bBuf = Buffer.from(b, "hex");
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export async function POST(req: NextRequest) {
  const secret = process.env.BACKEND_SIGNING_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Missing BACKEND_SIGNING_SECRET" }, { status: 500 });
  }

  const userId = req.headers.get("x-user-id") || "";
  const userEmail = req.headers.get("x-user-email") || "";
  const ts = req.headers.get("x-signature-timestamp") || "";
  const sig = req.headers.get("x-signature") || "";

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // allow empty body
  }

  if (!userId || !ts || !sig) {
    return NextResponse.json({ error: "Missing signature headers" }, { status: 401 });
  }

  const payload = `${ts}.${userId}.${JSON.stringify(body || {})}`;
  const expected = hmacHex(secret, payload);

  if (!timingSafeEqualHex(expected, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    received: body || null,
    user: { id: userId, email: userEmail },
    ts: Number(ts),
  });
}