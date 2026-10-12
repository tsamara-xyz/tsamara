import { expect, test } from "bun:test";
import { Keypair, PublicKey } from "@solana/web3.js";
import { parseWallet, rateLimiter } from "./http";

test("the rate limiter allows `max` calls per window and per caller, then recovers", () => {
  const allowed = rateLimiter(2, 1_000);
  expect([allowed("a", 0), allowed("a", 1), allowed("a", 2)]).toEqual([true, true, false]);
  expect(allowed("b", 2)).toBe(true);
  expect(allowed("a", 1_000)).toBe(true);
});

test("a wallet must be a valid address on the curve", () => {
  const wallet = Keypair.generate().publicKey;
  expect(parseWallet(wallet.toBase58()).equals(wallet)).toBe(true);
  expect(() => parseWallet("nope")).toThrow(/not a valid address/);
  const [programAddress] = PublicKey.findProgramAddressSync([Buffer.from("x")], PublicKey.default);
  expect(() => parseWallet(programAddress.toBase58())).toThrow(/program address/);
});
