import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import type { Investor } from "./kyc";
import type { SeriesTerms } from "./series";

// Client for the tsamara-compliance program (contracts/programs/tsamara-compliance): a Token-2022
// transfer hook that checks the recipient's investor record and the holding cap on every transfer.

export const COMPLIANCE_PROGRAM_ID = new PublicKey("EjYxuJE4QE8P37scBxgWRHGigZ8hP6j3ysnSQ95MWXXG");

/** Anchor instruction discriminators: the first 8 bytes of sha256("global:<name>"). */
export const DISCRIMINATORS: Record<"initialize_series" | "register_investor", number[]> = {
  initialize_series: [213, 66, 16, 50, 245, 32, 191, 253],
  register_investor: [95, 16, 66, 212, 152, 123, 136, 173],
};

const pda = (...seeds: (string | PublicKey)[]) =>
  PublicKey.findProgramAddressSync(
    seeds.map((s) => (typeof s === "string" ? Buffer.from(s) : s.toBuffer())),
    COMPLIANCE_PROGRAM_ID,
  )[0];

export const configPda = (mint: PublicKey) => pda("config", mint);
export const investorPda = (mint: PublicKey, wallet: PublicKey) => pda("investor", mint, wallet);
export const extraAccountMetasPda = (mint: PublicKey) => pda("extra-account-metas", mint);

const jurisdictionBytes = (code: string) => {
  if (!/^[A-Za-z]{2}$/.test(code)) throw new Error(`"${code}" is not an ISO 3166-1 alpha-2 code`);
  return Buffer.from(code.toUpperCase(), "ascii");
};

/** Attach the series' holding cap and restricted jurisdictions to its mint. Sign with payer and compliance. */
export function initializeComplianceIx(p: {
  payer: PublicKey;
  compliance: PublicKey;
  mint: PublicKey;
  terms: SeriesTerms;
}): TransactionInstruction {
  const restricted = p.terms.restrictedJurisdictions.map(jurisdictionBytes);
  const data = Buffer.alloc(8 + 8 + 4);
  data.set(DISCRIMINATORS.initialize_series, 0);
  data.writeBigUInt64LE(p.terms.maxHolding, 8);
  data.writeUInt32LE(restricted.length, 16);
  return new TransactionInstruction({
    programId: COMPLIANCE_PROGRAM_ID,
    keys: [
      { pubkey: p.payer, isSigner: true, isWritable: true },
      { pubkey: p.compliance, isSigner: true, isWritable: false },
      { pubkey: p.mint, isSigner: false, isWritable: false },
      { pubkey: configPda(p.mint), isSigner: false, isWritable: true },
      { pubkey: extraAccountMetasPda(p.mint), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([data, ...restricted]),
  });
}

/** Record a KYC'd investor onchain. The program rejects restricted jurisdictions. Sign with payer and compliance. */
export function registerInvestorIx(p: {
  payer: PublicKey;
  compliance: PublicKey;
  mint: PublicKey;
  investor: Investor;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: COMPLIANCE_PROGRAM_ID,
    keys: [
      { pubkey: p.payer, isSigner: true, isWritable: true },
      { pubkey: p.compliance, isSigner: true, isWritable: false },
      { pubkey: configPda(p.mint), isSigner: false, isWritable: false },
      { pubkey: p.investor.wallet, isSigner: false, isWritable: false },
      { pubkey: investorPda(p.mint, p.investor.wallet), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([Buffer.from(DISCRIMINATORS.register_investor), jurisdictionBytes(p.investor.jurisdiction)]),
  });
}
