// End-to-end sukuk lifecycle on Solana devnet. Doubles as the integration check: it throws if any rule is not enforced.
// Run from the repo root: bun run demo

import assert from "node:assert";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createMint,
  createMintToInstruction,
  getAccount,
  TOKEN_2022_PROGRAM_ID as T22,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  type PublicKey,
  SystemProgram,
  sendAndConfirmTransaction,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  approveInvestorIxs,
  ata,
  distributionIxs,
  initializeComplianceIx,
  issueSeriesIxs,
  type PaymentToken,
  registerInvestorIx,
  type SeriesTerms,
  subscribeIxs,
  tradeIxs,
  transferIx,
} from "@tsamara/sukuk";

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
  restrictedJurisdictions: ["US"],
  maxHolding: 100n,
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
  const issuer = key("issuer"),
    compliance = key("compliance"),
    amira = key("investor-amira"),
    lukas = key("investor-lukas"),
    stranger = key("no-kyc");
  if ((await conn.getBalance(issuer.publicKey)) < 0.5 * LAMPORTS_PER_SOL) {
    console.log(
      `Fund the issuer with devnet SOL, then rerun:\n  ${issuer.publicKey.toBase58()}\n  https://faucet.solana.com`,
    );
    process.exit(1);
  }
  // Investors need a little SOL to sign.
  const unfunded = [];
  for (const k of [amira, lukas, stranger])
    if ((await conn.getBalance(k.publicKey)) < 0.01 * LAMPORTS_PER_SOL) unfunded.push(k);
  if (unfunded.length)
    await send(
      unfunded.map((k) =>
        SystemProgram.transfer({
          fromPubkey: issuer.publicKey,
          toPubkey: k.publicKey,
          lamports: 0.02 * LAMPORTS_PER_SOL,
        }),
      ),
      [issuer],
    );

  // 1. Mock dollar stablecoin on the same token program and decimals as USDC, then the sukuk series.
  const usdc: PaymentToken = {
    mint: await createMint(conn, issuer, issuer.publicKey, null, 6),
    decimals: 6,
    programId: TOKEN_PROGRAM_ID,
  };
  const usdcBal = (owner: PublicKey) => bal(usdc.mint, owner, usdc.programId);
  const sukuk = Keypair.generate();
  const s1 = await send(
    await issueSeriesIxs(conn, {
      issuer: issuer.publicKey,
      compliance: compliance.publicKey,
      mint: sukuk.publicKey,
      terms,
    }),
    [issuer, sukuk],
  );
  await send(
    [
      initializeComplianceIx({
        payer: issuer.publicKey,
        compliance: compliance.publicKey,
        mint: sukuk.publicKey,
        terms,
      }),
    ],
    [issuer, compliance],
  );
  console.log("1. Sukuk series issued with compliance rules:", sukuk.publicKey.toBase58(), "\n  ", link(s1));

  // Open everyone's accounts and give investors $5,000 each.
  const everyone = [issuer, amira, lukas, stranger];
  await send(
    [
      ...everyone.map((k) =>
        createAssociatedTokenAccountIdempotentInstruction(
          issuer.publicKey,
          ata(usdc.mint, k.publicKey, usdc.programId),
          k.publicKey,
          usdc.mint,
          usdc.programId,
        ),
      ),
      ...everyone.map((k) =>
        createAssociatedTokenAccountIdempotentInstruction(
          issuer.publicKey,
          ata(sukuk.publicKey, k.publicKey),
          k.publicKey,
          sukuk.publicKey,
          T22,
        ),
      ),
      ...[amira, lukas, stranger].map((k) =>
        createMintToInstruction(
          usdc.mint,
          ata(usdc.mint, k.publicKey, usdc.programId),
          issuer.publicKey,
          5_000n * USD,
          [],
          usdc.programId,
        ),
      ),
    ],
    [issuer],
  );

  // 2. KYC: only the compliance authority can approve investors, and only in jurisdictions where the series is offered.
  const [amiraKyc, lukasKyc] = [
    { wallet: amira.publicKey, jurisdiction: "AE" },
    { wallet: lukas.publicKey, jurisdiction: "DE" },
  ];
  const approve = (investor: typeof amiraKyc, signer: Keypair) =>
    approveInvestorIxs({
      sukukMint: sukuk.publicKey,
      investor,
      payer: issuer.publicKey,
      compliance: signer.publicKey,
      terms,
    });
  await assert.rejects(send(approve(amiraKyc, issuer), [issuer]), "issuer key was able to approve an investor");
  // The compliance program itself refuses a US resident, even when the client-side check is skipped.
  const us = { wallet: stranger.publicKey, jurisdiction: "US" };
  assert.throws(() => approve(us, compliance), /not offered/);
  const registerUs = registerInvestorIx({
    payer: issuer.publicKey,
    compliance: compliance.publicKey,
    mint: sukuk.publicKey,
    investor: us,
  });
  await assert.rejects(send([registerUs], [issuer, compliance]), /RestrictedJurisdiction|0x1772/);
  await send([...approve(amiraKyc, compliance), ...approve(lukasKyc, compliance)], [issuer, compliance]);
  console.log("2. KYC approved for Amira (AE) and Lukas (DE); issuer key and US resident refused onchain");

  // 3. Primary subscription: Amira pays $1,000 and receives 100 units in the same transaction.
  const s3 = await send(
    subscribeIxs({
      sukukMint: sukuk.publicKey,
      payment: usdc,
      issuer: issuer.publicKey,
      investor: amira.publicKey,
      units: 100n,
      terms,
    }),
    [issuer, amira],
  );
  assert.equal(await bal(sukuk.publicKey, amira.publicKey), 100n);
  assert.equal(await usdcBal(issuer.publicKey), 1_000n * USD);
  console.log("3. Amira subscribed 100 units for $1,000.00\n  ", link(s3));

  // 4. Secondary trade: Amira sells 40 units to Lukas at par.
  const s4 = await send(
    await tradeIxs(conn, {
      sukukMint: sukuk.publicKey,
      payment: usdc,
      seller: amira.publicKey,
      buyer: lukas.publicKey,
      units: 40n,
      price: 400n * USD,
    }),
    [amira, lukas],
  );
  assert.equal(await bal(sukuk.publicKey, lukas.publicKey), 40n);
  assert.equal(await usdcBal(amira.publicKey), 4_400n * USD);
  console.log("4. Amira sold 40 units to Lukas for $400.00, settled in one transaction\n  ", link(s4));

  // 5. A transfer to a wallet without KYC must be rejected by the token program itself.
  const toStranger = await transferIx(conn, sukuk.publicKey, amira.publicKey, stranger.publicKey, 10n);
  await assert.rejects(send([toStranger], [amira]), /frozen|0x11/i);
  assert.equal(await bal(sukuk.publicKey, stranger.publicKey), 0n);
  console.log("5. Transfer to non-KYC wallet rejected onchain (account frozen)");

  // 6. Semiannual distribution, paid pro rata from the issuer's treasury.
  const holders = [amira, lukas];
  const before = await Promise.all(holders.map((k) => usdcBal(k.publicKey)));
  const holdings = await Promise.all(
    holders.map(async (k) => ({ owner: k.publicKey, units: await bal(sukuk.publicKey, k.publicKey) })),
  );
  const { ixs, payouts } = distributionIxs(usdc, issuer.publicKey, holdings, terms);
  const s6 = await send(ixs, [issuer]);
  assert.deepEqual(
    payouts.map((p) => p.amount),
    [15_600_000n, 10_400_000n],
  );
  for (const [i, k] of holders.entries()) assert.equal(await usdcBal(k.publicKey), before[i]! + payouts[i]!.amount);
  console.log(`6. Distribution paid: Amira ${usd(payouts[0]!.amount)}, Lukas ${usd(payouts[1]!.amount)}\n  `, link(s6));

  // 7. Holding cap: Lukas tops up to 90 units, so receiving 20 more would exceed the 100-unit cap.
  await send(
    subscribeIxs({
      sukukMint: sukuk.publicKey,
      payment: usdc,
      issuer: issuer.publicKey,
      investor: lukas.publicKey,
      units: 50n,
      terms,
    }),
    [issuer, lukas],
  );
  const overCap = await transferIx(conn, sukuk.publicKey, amira.publicKey, lukas.publicKey, 20n);
  await assert.rejects(send([overCap], [amira]), /HoldingCapExceeded|0x1773/);
  const atCap = await transferIx(conn, sukuk.publicKey, amira.publicKey, lukas.publicKey, 10n);
  const s7 = await send([atCap], [amira]);
  assert.equal(await bal(sukuk.publicKey, lukas.publicKey), 100n);
  console.log(
    "7. Transfer above the 100-unit cap rejected by the compliance program; a transfer up to the cap succeeded\n  ",
    link(s7),
  );

  // Let the indexer and app find this run.
  writeFileSync(
    ".keys/last-run.json",
    JSON.stringify({ sukukMint: sukuk.publicKey, paymentMint: usdc.mint, issuer: issuer.publicKey }, null, 2),
  );
  console.log("\nAll checks passed.");
}

main().catch((e) => {
  console.error(e?.logs ?? e);
  process.exit(1);
});
