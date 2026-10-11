// Signed calls to the Sumsub API (KYC provider). Sandbox credentials only.
import { createHmac } from "node:crypto";

const TOKEN = process.env.SUMSUB_TOKEN;
const SECRET = process.env.SUMSUB_SECRET;
export const LEVEL = process.env.SUMSUB_LEVEL ?? "id-and-liveness";
export const sumsubConfigured = Boolean(TOKEN && SECRET);

export async function sumsub<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  if (!TOKEN || !SECRET) throw new Error("Sumsub is not configured: set SUMSUB_TOKEN and SUMSUB_SECRET");
  // This prototype must never create real applicants.
  if (!TOKEN.startsWith("sbx:")) throw new Error("Refusing to use a non-sandbox Sumsub token");
  const payload = body === undefined ? "" : JSON.stringify(body);
  const ts = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac("sha256", SECRET)
    .update(ts + method + path + payload)
    .digest("hex");
  const res = await fetch(`https://api.sumsub.com${path}`, {
    method,
    headers: {
      "X-App-Token": TOKEN,
      "X-App-Access-Ts": ts,
      "X-App-Access-Sig": signature,
      ...(payload ? { "content-type": "application/json" } : {}),
    },
    body: payload || undefined,
  });
  const data = (await res.json().catch(() => ({}))) as { description?: string };
  if (!res.ok)
    throw Object.assign(new Error(data.description ?? `Sumsub request failed (${res.status})`), { status: res.status });
  return data as T;
}
