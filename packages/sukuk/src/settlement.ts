import type { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID as T22, createMintToInstruction, createTransferCheckedInstruction } from "@solana/spl-token";
import { type PaymentToken, SUKUK_DECIMALS, ata } from "./mint";
import type { SeriesTerms } from "./series";

// Both legs of a settlement go in one transaction, so delivery and payment succeed or fail together.

export const payIx = (t: PaymentToken, from: PublicKey, to: PublicKey, amount: bigint) =>
  createTransferCheckedInstruction(
    ata(t.mint, from, t.programId), t.mint, ata(t.mint, to, t.programId), from, amount, t.decimals, [], t.programId,
  );

/** Primary subscription at par: investor pays, issuer mints sukuk. Sign with issuer and investor. */
export function subscribeIxs(p: {
  sukukMint: PublicKey; payment: PaymentToken; issuer: PublicKey; investor: PublicKey; units: bigint; terms: SeriesTerms;
}): TransactionInstruction[] {
  return [
    payIx(p.payment, p.investor, p.issuer, p.units * p.terms.unitValue),
    createMintToInstruction(p.sukukMint, ata(p.sukukMint, p.investor), p.issuer, p.units, [], T22),
  ];
}

/** Secondary trade between two KYC'd investors. Sign with seller and buyer. */
export function tradeIxs(p: {
  sukukMint: PublicKey; payment: PaymentToken; seller: PublicKey; buyer: PublicKey; units: bigint; price: bigint;
}): TransactionInstruction[] {
  return [
    createTransferCheckedInstruction(
      ata(p.sukukMint, p.seller), p.sukukMint, ata(p.sukukMint, p.buyer), p.seller, p.units, SUKUK_DECIMALS, [], T22,
    ),
    payIx(p.payment, p.buyer, p.seller, p.price),
  ];
}
