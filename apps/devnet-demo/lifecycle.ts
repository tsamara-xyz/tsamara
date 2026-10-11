// End-to-end sukuk lifecycle on Solana devnet. Doubles as the integration check: it throws if any rule is not enforced.
// Run from the repo root: bun run demo
import {
  Connection, Keypair, LAMPORTS_PER_SOL, type PublicKey, SystemProgram, Transaction, type TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID as T22, createAssociatedTokenAccountIdempotentInstruction, createMintToInstruction,
  createTransferCheckedInstruction, getAccount,
} from "@solana/spl-token";
import {
  DECIMALS, type SeriesTerms, approveInvestorIx, ata, createMintIxs, imbalanIxs, issueSeriesIxs, subscribeIxs, tradeIxs,
} from "@tsamara/sukuk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert";

const conn = new Connection(process.env.RPC ?? "https://api.devnet.solana.com", "confirmed");

// Mock series for the demo; not a real issuance.
const terms: SeriesTerms = {
  name: "Sukuk Negara Ritel Demo 2029",
  symbol: "SRD29",
  akad: "Ijarah Asset to be Leased",
  maturity: "2029-10-10",
  imbalanBps: 625,
  unitRupiah: 10_000,
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
const bal = async (mint: PublicKey, owner: PublicKey) => (await getAccount(conn, ata(mint, owner), "confirmed", T22)).amount;
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

  // 1. Mock rupiah (1 token = Rp1) and the sukuk series.
  const idr = Keypair.generate(), sukuk = Keypair.generate();
  await send(await createMintIxs(conn, { payer: issuer.publicKey, mint: idr.publicKey, authority: issuer.publicKey, name: "Mock Rupiah", symbol: "mIDR" }), [issuer, idr]);
  const s1 = await send(await issueSeriesIxs(conn, issuer.publicKey, sukuk.publicKey, terms), [issuer, sukuk]);
  console.log("1. Sukuk series issued:", sukuk.publicKey.toBase58(), "\n  ", link(s1));

  // Open everyone's accounts and give investors rupiah.
  await send([
    ...[issuer, ani, budi, stranger].flatMap((k) => [idr, sukuk].map((m) =>
      createAssociatedTokenAccountIdempotentInstruction(issuer.publicKey, ata(m.publicKey, k.publicKey), k.publicKey, m.publicKey, T22))),
    ...[ani, budi, stranger].map((k) => createMintToInstruction(idr.publicKey, ata(idr.publicKey, k.publicKey), issuer.publicKey, 5_000_000, [], T22)),
  ], [issuer]);

  // 2. KYC: the issuer approves Ani and Budi. The stranger stays frozen.
  await send([ani, budi].map((k) => approveInvestorIx(sukuk.publicKey, k.publicKey, issuer.publicKey)), [issuer]);
  console.log("2. KYC approved for Ani and Budi");

  // 3. Primary subscription: Ani pays Rp1.000.000 and receives 100 units in the same transaction.
  const s3 = await send(subscribeIxs({ sukukMint: sukuk.publicKey, idrMint: idr.publicKey, issuer: issuer.publicKey, investor: ani.publicKey, units: 100n, terms }), [issuer, ani]);
  assert.equal(await bal(sukuk.publicKey, ani.publicKey), 100n);
  assert.equal(await bal(idr.publicKey, issuer.publicKey), 1_000_000n);
  console.log("3. Ani subscribed 100 units for Rp1.000.000\n  ", link(s3));

  // 4. Secondary trade: Ani sells 40 units to Budi at par.
  const s4 = await send(tradeIxs({ sukukMint: sukuk.publicKey, idrMint: idr.publicKey, seller: ani.publicKey, buyer: budi.publicKey, units: 40n, priceRupiah: 400_000n }), [ani, budi]);
  assert.equal(await bal(sukuk.publicKey, budi.publicKey), 40n);
  console.log("4. Ani sold 40 units to Budi, settled in one transaction\n  ", link(s4));

  // 5. A transfer to a wallet without KYC must be rejected by the token program itself.
  let rejected = false;
  try {
    await send([createTransferCheckedInstruction(ata(sukuk.publicKey, ani.publicKey), sukuk.publicKey, ata(sukuk.publicKey, stranger.publicKey), ani.publicKey, 10, DECIMALS, [], T22)], [ani]);
  } catch (e) {
    rejected = /frozen|0x11/i.test(String((e as { logs?: string[] })?.logs ?? e));
  }
  assert.ok(rejected, "transfer to a non-KYC wallet was NOT rejected");
  assert.equal(await bal(sukuk.publicKey, stranger.publicKey), 0n);
  console.log("5. Transfer to non-KYC wallet rejected onchain (account frozen)");

  // 6. Monthly imbalan, paid pro rata in rupiah from the issuer's treasury.
  const holders = [ani, budi];
  const before = await Promise.all(holders.map((k) => bal(idr.publicKey, k.publicKey)));
  const holdings = await Promise.all(holders.map(async (k) => ({ owner: k.publicKey, units: await bal(sukuk.publicKey, k.publicKey) })));
  const { ixs, payouts } = imbalanIxs(idr.publicKey, issuer.publicKey, holdings, terms);
  const s6 = await send(ixs, [issuer]);
  assert.deepEqual(payouts.map((p) => p.rupiah), [3125n, 2083n]);
  for (const [i, k] of holders.entries()) assert.equal(await bal(idr.publicKey, k.publicKey), before[i]! + payouts[i]!.rupiah);
  console.log(`6. Imbalan paid: Ani Rp${payouts[0]!.rupiah}, Budi Rp${payouts[1]!.rupiah}\n  `, link(s6));

  console.log("\nAll checks passed.");
}

main().catch((e) => {
  console.error(e?.logs ?? e);
  process.exit(1);
});
