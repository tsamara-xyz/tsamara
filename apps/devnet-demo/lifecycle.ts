// End-to-end sukuk lifecycle on Solana devnet. Doubles as the integration check: it throws if any rule is not enforced.
// Run from the repo root: bun run demo
import {
  Connection, Keypair, LAMPORTS_PER_SOL, type PublicKey, SystemProgram, Transaction, type TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID as T22, TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction, createMint,
  createMintToInstruction, createTransferCheckedInstruction, getAccount,
} from "@solana/spl-token";
import {
  type PaymentToken, SUKUK_DECIMALS, type SeriesTerms, approveInvestorIx, ata, distributionIxs, issueSeriesIxs,
  subscribeIxs, tradeIxs,
} from "@tsamara/sukuk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert";

const conn = new Connection(process.env.RPC ?? "https://api.devnet.solana.com", "confirmed");
const USD = 1_000_000n; // one dollar in a 6-decimal token
const usd = (n: bigint) => `$${(Number(n) / 1e6).toFixed(2)}`;

// Mock series for the demo; not a real issuance.
const terms: SeriesTerms = {
  name: "Global Sukuk Demo 2031",
  symbol: "GSD31",
  akad: "Wakalah",
  maturity: "2031-10-10",
  currency: "USD",
  profitRateBps: 520,
  paymentsPerYear: 2,
  unitValue: 10n * USD,
};

// Devnet-only keys, persisted so reruns reuse the same funded issuer.
function key(name: string): Keypair {
  mkdirSync(".keys", { recursive: true });
  const f = `.keys/${name}.json`;
  if (existsSync(f)) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(f, "utf8"))));
  const k = Keypair.generate();
  writeFileSync(f, JSON.stringify([...k.secretKey]), { mode: 0o600 });
  return k;
}

const send = (ixs: TransactionInstruction[], signers: Keypair[]) =>
  sendAndConfirmTransaction(conn, new Transaction().add(...ixs), signers);
const bal = async (mint: PublicKey, owner: PublicKey, programId = T22) =>
  (await getAccount(conn, ata(mint, owner, programId), "confirmed", programId)).amount;
const link = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;

async function main() {
  const issuer = key("issuer"), ani = key("investor-ani"), budi = key("investor-budi"), stranger = key("no-kyc");
  if ((await conn.getBalance(issuer.publicKey)) < 0.5 * LAMPORTS_PER_SOL) {
    console.log(`Fund the issuer with devnet SOL, then rerun:\n  ${issuer.publicKey.toBase58()}\n  https://faucet.solana.com`);
    process.exit(1);
  }
  // Investors need a little SOL to sign.
  const unfunded = [];
  for (const k of [ani, budi, stranger]) if ((await conn.getBalance(k.publicKey)) < 0.01 * LAMPORTS_PER_SOL) unfunded.push(k);
  if (unfunded.length)
    await send(unfunded.map((k) => SystemProgram.transfer({ fromPubkey: issuer.publicKey, toPubkey: k.publicKey, lamports: 0.02 * LAMPORTS_PER_SOL })), [issuer]);

  // 1. Mock dollar stablecoin on the same token program and decimals as USDC, then the sukuk series.
  const usdc: PaymentToken = { mint: await createMint(conn, issuer, issuer.publicKey, null, 6), decimals: 6, programId: TOKEN_PROGRAM_ID };
  const usdcBal = (owner: PublicKey) => bal(usdc.mint, owner, usdc.programId);
  const sukuk = Keypair.generate();
  const s1 = await send(await issueSeriesIxs(conn, issuer.publicKey, sukuk.publicKey, terms), [issuer, sukuk]);
  console.log("1. Sukuk series issued:", sukuk.publicKey.toBase58(), "\n  ", link(s1));

  // Open everyone's accounts and give investors $5,000 each.
  const everyone = [issuer, ani, budi, stranger];
  await send([
    ...everyone.map((k) => createAssociatedTokenAccountIdempotentInstruction(issuer.publicKey, ata(usdc.mint, k.publicKey, usdc.programId), k.publicKey, usdc.mint, usdc.programId)),
    ...everyone.map((k) => createAssociatedTokenAccountIdempotentInstruction(issuer.publicKey, ata(sukuk.publicKey, k.publicKey), k.publicKey, sukuk.publicKey, T22)),
    ...[ani, budi, stranger].map((k) => createMintToInstruction(usdc.mint, ata(usdc.mint, k.publicKey, usdc.programId), issuer.publicKey, 5_000n * USD, [], usdc.programId)),
  ], [issuer]);

  // 2. KYC: the issuer approves Ani and Budi. The stranger stays frozen.
  await send([ani, budi].map((k) => approveInvestorIx(sukuk.publicKey, k.publicKey, issuer.publicKey)), [issuer]);
  console.log("2. KYC approved for Ani and Budi");

  // 3. Primary subscription: Ani pays $1,000 and receives 100 units in the same transaction.
  const s3 = await send(subscribeIxs({ sukukMint: sukuk.publicKey, payment: usdc, issuer: issuer.publicKey, investor: ani.publicKey, units: 100n, terms }), [issuer, ani]);
  assert.equal(await bal(sukuk.publicKey, ani.publicKey), 100n);
  assert.equal(await usdcBal(issuer.publicKey), 1_000n * USD);
  console.log("3. Ani subscribed 100 units for $1,000.00\n  ", link(s3));

  // 4. Secondary trade: Ani sells 40 units to Budi at par.
  const s4 = await send(tradeIxs({ sukukMint: sukuk.publicKey, payment: usdc, seller: ani.publicKey, buyer: budi.publicKey, units: 40n, price: 400n * USD }), [ani, budi]);
  assert.equal(await bal(sukuk.publicKey, budi.publicKey), 40n);
  assert.equal(await usdcBal(ani.publicKey), 4_400n * USD);
  console.log("4. Ani sold 40 units to Budi for $400.00, settled in one transaction\n  ", link(s4));

  // 5. A transfer to a wallet without KYC must be rejected by the token program itself.
  let rejected = false;
  try {
    await send([createTransferCheckedInstruction(ata(sukuk.publicKey, ani.publicKey), sukuk.publicKey, ata(sukuk.publicKey, stranger.publicKey), ani.publicKey, 10, SUKUK_DECIMALS, [], T22)], [ani]);
  } catch (e) {
    rejected = /frozen|0x11/i.test(String((e as { logs?: string[] })?.logs ?? e));
  }
  assert.ok(rejected, "transfer to a non-KYC wallet was NOT rejected");
  assert.equal(await bal(sukuk.publicKey, stranger.publicKey), 0n);
  console.log("5. Transfer to non-KYC wallet rejected onchain (account frozen)");

  // 6. Semiannual distribution, paid pro rata from the issuer's treasury.
  const holders = [ani, budi];
  const before = await Promise.all(holders.map((k) => usdcBal(k.publicKey)));
  const holdings = await Promise.all(holders.map(async (k) => ({ owner: k.publicKey, units: await bal(sukuk.publicKey, k.publicKey) })));
  const { ixs, payouts } = distributionIxs(usdc, issuer.publicKey, holdings, terms);
  const s6 = await send(ixs, [issuer]);
  assert.deepEqual(payouts.map((p) => p.amount), [15_600_000n, 10_400_000n]);
  for (const [i, k] of holders.entries()) assert.equal(await usdcBal(k.publicKey), before[i]! + payouts[i]!.amount);
  console.log(`6. Distribution paid: Ani ${usd(payouts[0]!.amount)}, Budi ${usd(payouts[1]!.amount)}\n  `, link(s6));

  console.log("\nAll checks passed.");
}

main().catch((e) => {
  console.error(e?.logs ?? e);
  process.exit(1);
});
