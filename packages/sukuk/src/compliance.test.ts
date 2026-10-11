import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { Keypair } from "@solana/web3.js";
import { DISCRIMINATORS, initializeComplianceIx, registerInvestorIx } from "./compliance";
import type { SeriesTerms } from "./series";

const key = () => Keypair.generate().publicKey;

test("discriminators match Anchor's sha256(global:<name>)", () => {
  for (const [name, bytes] of Object.entries(DISCRIMINATORS)) {
    const expected = [...createHash("sha256").update(`global:${name}`).digest().subarray(0, 8)];
    expect([...bytes]).toEqual(expected);
  }
});

test("initialize_series encodes the cap and the restricted jurisdictions", () => {
  const terms = { maxHolding: 100n, restrictedJurisdictions: ["US", "kp"] } as SeriesTerms;
  const { data } = initializeComplianceIx({ payer: key(), compliance: key(), mint: key(), terms });
  expect(data.readBigUInt64LE(8)).toBe(100n);
  expect(data.readUInt32LE(16)).toBe(2);
  expect(data.subarray(20).toString("ascii")).toBe("USKP");
});

test("register_investor rejects malformed jurisdiction codes", () => {
  const build = (jurisdiction: string) =>
    registerInvestorIx({ payer: key(), compliance: key(), mint: key(), investor: { wallet: key(), jurisdiction } });
  expect(build("ae").data.subarray(8).toString("ascii")).toBe("AE");
  expect(() => build("UAE")).toThrow();
});
