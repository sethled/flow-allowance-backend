import crypto from "crypto";

const secret = process.env.BACKEND_SIGNING_SECRET;
if (!secret) throw new Error("Missing BACKEND_SIGNING_SECRET");

// Same values we’ll use in the curl request
const ts = Math.floor(Date.now() / 1000);   // current epoch seconds
const userId = "test-user";
const body = JSON.stringify({ hello: "world" });

const payload = `${ts}.${userId}.${body}`;
const key = Buffer.from(secret.replace(/^base64:/, ""), "base64");
const sig = crypto.createHmac("sha256", key).update(payload).digest("hex");

console.log("Timestamp:", ts);
console.log("Signature:", sig);
