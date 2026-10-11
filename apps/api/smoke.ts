// biome-ignore-all lint/suspicious/noExplicitAny: untyped JSON responses in a smoke script
// Smoke check against a running API: a fresh investor goes from faucet to distribution.
// Run: ADMIN_TOKEN=<token> bun apps/api/smoke.ts   (with `bun run api` running)

import assert from "node:assert";
import { Connection, Keypair, Transaction } from "@solana/web3.js";

const API = process.env.API ?? "http://localhost:8788";
const conn = new Connection(process.env.RPC ?? "https://api.devnet.solana.com", "confirmed");
const admin = { "x-admin-token": process.env.ADMIN_TOKEN ?? "" };

async function call(path: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(API + path, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: (await res.json()) as Record<string, any> };
}

const investor = Keypair.generate();
const wallet = investor.publicKey.toBase58();

assert.equal((await call("/series")).data.terms.symbol, "GSD31");
assert.equal(
  (await call("/admin/kyc", { wallet, jurisdiction: "AE" })).status,
  401,
  "admin route must require the token",
);
assert.equal((await call("/faucet", { wallet })).status, 200);
assert.equal(
  (await call("/admin/kyc", { wallet, jurisdiction: "US" }, admin)).status,
  422,
  "US resident must be refused",
);
assert.equal((await call("/admin/kyc", { wallet, jurisdiction: "AE" }, admin)).status, 200);
assert.equal(
  (await call("/subscribe", { wallet, units: 101 })).status,
  422,
  "subscription above the cap must be refused",
);

const { data } = await call("/subscribe", { wallet, units: 25 });
const tx = Transaction.from(Buffer.from(data.transaction, "base64"));
tx.partialSign(investor);
await conn.confirmTransaction(await conn.sendRawTransaction(tx.serialize()), "confirmed");
assert.equal((await call(`/investors/${wallet}`)).data.units, "25");

// Distributions read holders from the indexer, so wait until it has picked up the subscription.
const INDEXER = process.env.INDEXER ?? "http://localhost:8787";
for (let i = 0; ; i++) {
  const rows = (await (await fetch(`${INDEXER}/holders`)).json()) as { wallet: string; units: string }[];
  if (rows.some((r) => r.wallet === wallet && r.units === "25")) break;
  assert.ok(i < 30, "indexer did not pick up the subscription within 60s");
  await Bun.sleep(2000);
}

const paid = (await call("/admin/distribute", {}, admin)).data;
const mine = paid.payouts.find((p: { owner: string }) => p.owner === wallet);
assert.equal(mine.amount, "6500000"); // 25 units x $10 x 5.20% / 2 = $6.50
console.log("API smoke check passed for", wallet);
