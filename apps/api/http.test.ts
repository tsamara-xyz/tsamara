import { expect, test } from "bun:test";
import { Keypair, PublicKey } from "@solana/web3.js";
import { parseWallet, rateLimiter, reservations } from "./http";

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

test("reservations add up per key and lapse after their time", () => {
  const cosigned = reservations(1_000);
  cosigned.add("a", 60n, 0);
  cosigned.add("a", 30n, 500);
  expect(cosigned.total("a", 600)).toBe(90n);
  expect(cosigned.total("b", 600)).toBe(0n);
  expect(cosigned.total("a", 1_000)).toBe(30n);
  expect(cosigned.total("a", 1_500)).toBe(0n);
});
