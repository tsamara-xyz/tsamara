// Request parsing and response helpers shared by every route.
import { PublicKey } from "@solana/web3.js";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

export const fail = (status: 400 | 401 | 409 | 422 | 429 | 503, message: string): never => {
  throw new HTTPException(status, { message });
};

/** JSON-safe copy of a value: bigints become strings, public keys their base58 form. */
export const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v)));

export function parseWallet(value: unknown): PublicKey {
  let wallet: PublicKey;
  try {
    wallet = new PublicKey(String(value));
  } catch {
    return fail(400, "wallet is not a valid address");
  }
  // A program-derived address cannot sign, so it can be neither an investor nor a fee payer.
  if (!PublicKey.isOnCurve(wallet.toBytes())) fail(400, "wallet must be a wallet address, not a program address");
  return wallet;
}

/** The request body as an object; anything else is the caller's mistake, not a server error. */
export async function body(c: Context): Promise<Record<string, unknown>> {
  const value = await c.req.json().catch(() => null);
  if (value === null || typeof value !== "object" || Array.isArray(value))
    fail(400, "request body must be a JSON object");
  return value;
}

/**
 * A fixed-window limit per caller, in memory. Returns false once `max` calls were made within `windowMs`.
 */
// ponytail: one process, one map; move to a shared store once the API runs on more than one instance.
export function rateLimiter(max: number, windowMs: number) {
  const seen = new Map<string, { count: number; reset: number }>();
  return (key: string, now = Date.now()): boolean => {
    const entry = seen.get(key);
    if (!entry || now >= entry.reset) {
      seen.set(key, { count: 1, reset: now + windowMs });
      return true;
    }
    entry.count += 1;
    return entry.count <= max;
  };
}

/** The caller's address as the proxy in front of the API reports it. */
export const callerOf = (c: Context): string =>
  c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

export function parseUnits(value: unknown): bigint {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0 || n > 1_000_000) fail(400, "units must be a positive whole number");
  return BigInt(n);
}
