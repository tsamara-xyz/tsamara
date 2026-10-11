import {
  createMintToInstruction,
  createTransferCheckedInstruction,
  createTransferCheckedWithTransferHookInstruction,
  TOKEN_2022_PROGRAM_ID as T22,
} from "@solana/spl-token";
import type { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { ata, type PaymentToken, SUKUK_DECIMALS } from "./mint";
import type { SeriesTerms } from "./series";

// Both legs of a settlement go in one transaction, so delivery and payment succeed or fail together.

export const payIx = (t: PaymentToken, from: PublicKey, to: PublicKey, amount: bigint) =>
  createTransferCheckedInstruction(
    ata(t.mint, from, t.programId),
    t.mint,
    ata(t.mint, to, t.programId),
    from,
    amount,
    t.decimals,
    [],
    t.programId,
  );

/** Primary subscription at par: investor pays, issuer mints sukuk. Sign with issuer and investor. */
export function subscribeIxs(p: {
  sukukMint: PublicKey;
  payment: PaymentToken;
  issuer: PublicKey;
  investor: PublicKey;
  units: bigint;
  terms: SeriesTerms;
}): TransactionInstruction[] {
  return [
    payIx(p.payment, p.investor, p.issuer, p.units * p.terms.unitValue),
    createMintToInstruction(p.sukukMint, ata(p.sukukMint, p.investor), p.issuer, p.units, [], T22),
  ];
}

/** Move sukuk units. Resolves the extra accounts the compliance transfer hook needs from the chain. */
export const transferIx = (conn: Connection, sukukMint: PublicKey, from: PublicKey, to: PublicKey, units: bigint) =>
  createTransferCheckedWithTransferHookInstruction(
    conn,
    ata(sukukMint, from),
    sukukMint,
    ata(sukukMint, to),
    from,
    units,
    SUKUK_DECIMALS,
    [],
    "confirmed",
    T22,
  );

/** Secondary trade between two KYC'd investors. Sign with seller and buyer. */
export async function tradeIxs(
  conn: Connection,
  p: { sukukMint: PublicKey; payment: PaymentToken; seller: PublicKey; buyer: PublicKey; units: bigint; price: bigint },
): Promise<TransactionInstruction[]> {
  return [
    await transferIx(conn, p.sukukMint, p.seller, p.buyer, p.units),
    payIx(p.payment, p.buyer, p.seller, p.price),
  ];
}
