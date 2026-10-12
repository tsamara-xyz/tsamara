import { expect, test } from "bun:test";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair } from "@solana/web3.js";
import { COMPLIANCE_PROGRAM_ID } from "./compliance";
import { DEMO_SERIES } from "./demo-series";
import { distributionBatches, distributionIxs } from "./distribution";
import { approveInvestorIxs } from "./kyc";
import { ata, type PaymentToken } from "./mint";
import { subscribeIxs } from "./settlement";

const key = () => Keypair.generate().publicKey;
const usdc: PaymentToken = { mint: key(), decimals: 6, programId: TOKEN_PROGRAM_ID };
/** Token instructions carry the amount as a little-endian u64 right after the one-byte tag. */
const amount = (data: Buffer) => data.readBigUInt64LE(1);

test("subscription pays par value to the issuer and mints the units, on the right token programs", () => {
  const [sukukMint, issuer, investor] = [key(), key(), key()];
  const [pay, mint] = subscribeIxs({ sukukMint, payment: usdc, issuer, investor, units: 25n, terms: DEMO_SERIES });
  expect(pay?.programId).toEqual(TOKEN_PROGRAM_ID);
  expect(amount(pay?.data as Buffer)).toBe(250_000_000n); // 25 units x $10
  expect(pay?.keys[2]?.pubkey).toEqual(ata(usdc.mint, issuer, usdc.programId));
  expect(mint?.programId).toEqual(TOKEN_2022_PROGRAM_ID);
  expect(amount(mint?.data as Buffer)).toBe(25n);
  expect(mint?.keys[1]?.pubkey).toEqual(ata(sukukMint, investor));
});

test("distribution pays each holder pro rata and skips holders owed nothing", () => {
  const [issuer, a, b, empty] = [key(), key(), key(), key()];
  const holdings = [
    { owner: a, units: 60n },
    { owner: empty, units: 0n },
    { owner: b, units: 40n },
  ];
  const { ixs, payouts } = distributionIxs(usdc, issuer, holdings, DEMO_SERIES);
  expect(payouts.map((p) => p.amount)).toEqual([15_600_000n, 0n, 10_400_000n]);
  expect(ixs.map((ix) => amount(ix.data))).toEqual([15_600_000n, 10_400_000n]);
  expect(ixs.map((ix) => ix.keys[2]?.pubkey)).toEqual([
    ata(usdc.mint, a, usdc.programId),
    ata(usdc.mint, b, usdc.programId),
  ]);
});

test("approval registers the investor with the compliance program before opening their account", () => {
  const params = { sukukMint: key(), payer: key(), compliance: key(), terms: DEMO_SERIES };
  const ixs = approveInvestorIxs({ ...params, investor: { wallet: key(), jurisdiction: "AE" } });
  expect(ixs.map((ix) => ix.programId)).toEqual([COMPLIANCE_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]);
});

test("approval refuses a restricted jurisdiction before building any instruction", () => {
  const params = { sukukMint: key(), payer: key(), compliance: key(), terms: DEMO_SERIES };
  expect(() => approveInvestorIxs({ ...params, investor: { wallet: key(), jurisdiction: "us" } })).toThrow(
    /not offered/,
  );
});

test("a distribution is split into period-marked batches that do not depend on input order", () => {
  const issuer = key();
  const holdings = Array.from({ length: 17 }, () => ({ owner: key(), units: 10n }));
  const batches = distributionBatches(usdc, issuer, holdings, DEMO_SERIES, "2026-H2");
  expect(batches.map((b) => b.payouts.length)).toEqual([8, 8, 1]);
  expect(batches.map((b) => b.memo)).toEqual([
    "tsamara:distribution:GSD31:2026-H2:0",
    "tsamara:distribution:GSD31:2026-H2:1",
    "tsamara:distribution:GSD31:2026-H2:2",
  ]);
  // One memo, then one transfer per payout.
  expect(batches[0]?.ixs.length).toBe(9);
  expect(batches[0]?.ixs[0]?.data.toString("utf8")).toBe(batches[0]?.memo as string);
  const reversed = distributionBatches(usdc, issuer, [...holdings].reverse(), DEMO_SERIES, "2026-H2");
  expect(reversed.map((b) => b.payouts.map((p) => p.owner.toBase58()))).toEqual(
    batches.map((b) => b.payouts.map((p) => p.owner.toBase58())),
  );
});

test("a distribution needs a well-formed period, and pays nobody who is owed nothing", () => {
  const holdings = [{ owner: key(), units: 0n }];
  expect(distributionBatches(usdc, key(), holdings, DEMO_SERIES, "2026-H2")).toEqual([]);
  expect(() => distributionBatches(usdc, key(), holdings, DEMO_SERIES, "second half of 2026")).toThrow(/period/);
});
