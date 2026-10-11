import type { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, createFreezeAccountInstruction, createThawAccountInstruction } from "@solana/spl-token";
import { ata } from "./mint";
import { type SeriesTerms, isEligible } from "./series";

// The KYC gate is the token program itself: holder accounts are frozen by default,
// so a wallet can only hold or receive the sukuk after the compliance authority thaws its account.

export interface Investor {
  wallet: PublicKey;
  /** ISO 3166-1 alpha-2 country of residence, established by KYC. */
  jurisdiction: string;
}

/** Approve a KYC'd investor. Throws if the series is not offered in their jurisdiction. */
export function approveInvestorIx(sukukMint: PublicKey, investor: Investor, compliance: PublicKey, terms: SeriesTerms) {
  if (!isEligible(investor.jurisdiction, terms))
    throw new Error(`${terms.symbol} is not offered to residents of ${investor.jurisdiction}`);
  return createThawAccountInstruction(ata(sukukMint, investor.wallet), sukukMint, compliance, [], TOKEN_2022_PROGRAM_ID);
}

export const revokeInvestorIx = (sukukMint: PublicKey, wallet: PublicKey, compliance: PublicKey) =>
  createFreezeAccountInstruction(ata(sukukMint, wallet), sukukMint, compliance, [], TOKEN_2022_PROGRAM_ID);
