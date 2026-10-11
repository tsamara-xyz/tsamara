import type { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, createFreezeAccountInstruction, createThawAccountInstruction } from "@solana/spl-token";
import { ata } from "./mint";

// The KYC gate is the token program itself: holder accounts are frozen by default,
// so a wallet can only hold or receive the sukuk after the issuer thaws its account.

export const approveInvestorIx = (sukukMint: PublicKey, investor: PublicKey, issuer: PublicKey) =>
  createThawAccountInstruction(ata(sukukMint, investor), sukukMint, issuer, [], TOKEN_2022_PROGRAM_ID);

export const revokeInvestorIx = (sukukMint: PublicKey, investor: PublicKey, issuer: PublicKey) =>
  createFreezeAccountInstruction(ata(sukukMint, investor), sukukMint, issuer, [], TOKEN_2022_PROGRAM_ID);
