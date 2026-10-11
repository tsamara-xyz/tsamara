import { createFreezeAccountInstruction, createThawAccountInstruction, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import type { PublicKey } from "@solana/web3.js";
import { registerInvestorIx } from "./compliance";
import { ata } from "./mint";
import { isEligible, type SeriesTerms } from "./series";

// The KYC gate is the token program itself: holder accounts are frozen by default,
// so a wallet can only hold or receive the sukuk after the compliance authority thaws its account.

export interface Investor {
  wallet: PublicKey;
  /** ISO 3166-1 alpha-2 country of residence, established by KYC. */
  jurisdiction: string;
}

/**
 * Approve a KYC'd investor: record them with the compliance program, then open their account.
 * Throws early if the series is not offered in their jurisdiction; the program rejects it as well.
 * Sign with payer and compliance.
 */
export function approveInvestorIxs(p: {
  sukukMint: PublicKey;
  investor: Investor;
  payer: PublicKey;
  compliance: PublicKey;
  terms: SeriesTerms;
}) {
  if (!isEligible(p.investor.jurisdiction, p.terms))
    throw new Error(`${p.terms.symbol} is not offered to residents of ${p.investor.jurisdiction}`);
  return [
    registerInvestorIx({ payer: p.payer, compliance: p.compliance, mint: p.sukukMint, investor: p.investor }),
    createThawAccountInstruction(
      ata(p.sukukMint, p.investor.wallet),
      p.sukukMint,
      p.compliance,
      [],
      TOKEN_2022_PROGRAM_ID,
    ),
  ];
}

export const revokeInvestorIx = (sukukMint: PublicKey, wallet: PublicKey, compliance: PublicKey) =>
  createFreezeAccountInstruction(ata(sukukMint, wallet), sukukMint, compliance, [], TOKEN_2022_PROGRAM_ID);
