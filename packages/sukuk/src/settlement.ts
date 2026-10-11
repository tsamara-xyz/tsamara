import type { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID as T22, createMintToInstruction, createTransferCheckedInstruction } from "@solana/spl-token";
import { DECIMALS, ata } from "./mint";
import type { SeriesTerms } from "./series";

// Both legs of a settlement go in one transaction, so delivery and payment succeed or fail together.

const pay = (idrMint: PublicKey, from: PublicKey, to: PublicKey, rupiah: bigint) =>
  createTransferCheckedInstruction(ata(idrMint, from), idrMint, ata(idrMint, to), from, rupiah, DECIMALS, [], T22);

/** Primary subscription at par: investor pays rupiah, issuer mints sukuk. Sign with issuer and investor. */
export function subscribeIxs(p: {
  sukukMint: PublicKey; idrMint: PublicKey; issuer: PublicKey; investor: PublicKey; units: bigint; terms: SeriesTerms;
}): TransactionInstruction[] {
  return [
    pay(p.idrMint, p.investor, p.issuer, p.units * BigInt(p.terms.unitRupiah)),
    createMintToInstruction(p.sukukMint, ata(p.sukukMint, p.investor), p.issuer, p.units, [], T22),
  ];
}

/** Secondary trade between two KYC'd investors. Sign with seller and buyer. */
export function tradeIxs(p: {
  sukukMint: PublicKey; idrMint: PublicKey; seller: PublicKey; buyer: PublicKey; units: bigint; priceRupiah: bigint;
}): TransactionInstruction[] {
  return [
    createTransferCheckedInstruction(
      ata(p.sukukMint, p.seller), p.sukukMint, ata(p.sukukMint, p.buyer), p.seller, p.units, DECIMALS, [], T22,
    ),
    pay(p.idrMint, p.buyer, p.seller, p.priceRupiah),
  ];
}
