// Request parsing and response helpers shared by every route.
import { PublicKey } from "@solana/web3.js";
import { HTTPException } from "hono/http-exception";

export const fail = (status: 400 | 401 | 422 | 503, message: string): never => {
  throw new HTTPException(status, { message });
};

/** JSON-safe copy of a value: bigints become strings, public keys their base58 form. */
export const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v)));

export function parseWallet(value: unknown): PublicKey {
  try {
    return new PublicKey(String(value));
  } catch {
    return fail(400, "wallet is not a valid address");
  }
}

export function parseUnits(value: unknown): bigint {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0 || n > 1_000_000) fail(400, "units must be a positive whole number");
  return BigInt(n);
}
