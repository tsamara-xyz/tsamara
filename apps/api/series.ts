// Loads the operator keys and the live demo series, creating the series on first run.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createAssociatedTokenAccountIdempotent, createMint, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  DEMO_SERIES,
  initializeComplianceIx,
  issueSeriesIxs,
  type PaymentToken,
  publishTermsIxs,
} from "@tsamara/sukuk";

export const conn = new Connection(process.env.RPC ?? "https://api.devnet.solana.com", "confirmed");
export const terms = DEMO_SERIES;

// ponytail: operator keys are devnet files on disk; on mainnet these are multisigs and this service only proposes transactions.
const loadKey = (name: string) => {
  const file = `.keys/${name}.json`;
  if (!existsSync(file))
    throw new Error(`Missing ${file}. Run \`bun run demo\` once to create and fund the devnet keys.`);
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(file, "utf8"))));
};
export const issuer = loadKey("issuer");
export const compliance = loadKey("compliance");

export const send = (ixs: TransactionInstruction[], signers: Keypair[]) =>
  sendAndConfirmTransaction(conn, new Transaction().add(...ixs), signers);

const FILE = ".keys/series.json";

async function createSeries() {
  const paymentMint = await createMint(conn, issuer, issuer.publicKey, null, 6);
  // The treasury that receives subscriptions and pays distributions.
  await createAssociatedTokenAccountIdempotent(conn, issuer, paymentMint, issuer.publicKey);
  const mint = Keypair.generate();
  await send(
    await issueSeriesIxs(conn, {
      issuer: issuer.publicKey,
      compliance: compliance.publicKey,
      mint: mint.publicKey,
      terms,
    }),
    [issuer, mint],
  );
  await send(publishTermsIxs(issuer.publicKey, mint.publicKey, terms), [issuer]);
  await send(
    [
      initializeComplianceIx({
        payer: issuer.publicKey,
        compliance: compliance.publicKey,
        mint: mint.publicKey,
        terms,
      }),
    ],
    [issuer, compliance],
  );
  const series = {
    sukukMint: mint.publicKey.toBase58(),
    paymentMint: paymentMint.toBase58(),
    issuer: issuer.publicKey.toBase58(),
  };
  writeFileSync(FILE, JSON.stringify(series, null, 2));
  // The indexer reads the same shape from last-run.json.
  writeFileSync(".keys/last-run.json", JSON.stringify(series, null, 2));
  return series;
}

const saved = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : await createSeries();
export const sukukMint = new PublicKey(saved.sukukMint);
export const payment: PaymentToken = {
  mint: new PublicKey(saved.paymentMint),
  decimals: 6,
  programId: TOKEN_PROGRAM_ID,
};
