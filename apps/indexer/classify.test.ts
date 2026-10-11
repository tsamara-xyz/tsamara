import { expect, test } from "bun:test";
import { type Config, classify, type TokenBalance, type Tx } from "./classify";

const cfg: Config = { sukukMint: "SUKUK", paymentMint: "USDC", issuer: "issuer" };
const b = (i: number, mint: string, owner: string, amount: bigint): TokenBalance => ({
  accountIndex: i,
  mint,
  owner,
  uiTokenAmount: { amount: String(amount) },
});
const tx = (pre: TokenBalance[], post: TokenBalance[], instructionTypes: string[] = []): Tx => ({
  signature: "sig",
  slot: 1,
  blockTime: 1,
  pre,
  post,
  instructionTypes,
});

test("subscription: investor pays, units are minted", () => {
  const [e, ...rest] = classify(
    tx(
      [b(1, "USDC", "amira", 5000n), b(2, "USDC", "issuer", 0n), b(3, "SUKUK", "amira", 0n)],
      [b(1, "USDC", "amira", 4000n), b(2, "USDC", "issuer", 1000n), b(3, "SUKUK", "amira", 100n)],
      ["transferChecked", "mintTo"],
    ),
    cfg,
  );
  expect(rest).toEqual([]);
  expect(e).toMatchObject({ kind: "subscription", wallet: "amira", units: 100n, amount: 1000n });
});

test("trade: units move one way, payment the other", () => {
  const [e] = classify(
    tx(
      [
        b(1, "SUKUK", "amira", 100n),
        b(2, "SUKUK", "lukas", 0n),
        b(3, "USDC", "lukas", 5000n),
        b(4, "USDC", "amira", 4000n),
      ],
      [
        b(1, "SUKUK", "amira", 60n),
        b(2, "SUKUK", "lukas", 40n),
        b(3, "USDC", "lukas", 4600n),
        b(4, "USDC", "amira", 4400n),
      ],
    ),
    cfg,
  );
  expect(e).toMatchObject({ kind: "trade", wallet: "lukas", counterparty: "amira", units: 40n, amount: 400n });
});

test("distribution: one event per holder paid from the treasury", () => {
  const events = classify(
    tx(
      [b(1, "USDC", "issuer", 1000n), b(2, "USDC", "amira", 0n), b(3, "USDC", "lukas", 0n)],
      [b(1, "USDC", "issuer", 974n), b(2, "USDC", "amira", 16n), b(3, "USDC", "lukas", 10n)],
    ),
    cfg,
  );
  expect(events.map((e) => [e.kind, e.wallet, e.amount])).toEqual([
    ["distribution", "amira", 16n],
    ["distribution", "lukas", 10n],
  ]);
});

test("approval: no tokens move, wallets come from the sukuk accounts", () => {
  const bal = [b(1, "SUKUK", "amira", 0n), b(2, "SUKUK", "lukas", 0n)];
  expect(classify(tx(bal, bal, ["thawAccount", "thawAccount"]), cfg).map((e) => [e.kind, e.wallet])).toEqual([
    ["approved", "amira"],
    ["approved", "lukas"],
  ]);
});

test("unrelated transactions produce no events", () => {
  expect(classify(tx([], [], ["transfer"]), cfg)).toEqual([]);
});
