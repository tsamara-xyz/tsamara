import {
  AccountState,
  createInitializeDefaultAccountStateInstruction,
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  createInitializePermanentDelegateInstruction,
  createInitializeTransferHookInstruction,
  ExtensionType,
  getAssociatedTokenAddressSync,
  getMintLen,
  LENGTH_SIZE,
  TOKEN_2022_PROGRAM_ID as T22,
  TYPE_SIZE,
} from "@solana/spl-token";
import { createInitializeInstruction, createUpdateFieldInstruction, pack } from "@solana/spl-token-metadata";
import { type Connection, type PublicKey, SystemProgram, type TransactionInstruction } from "@solana/web3.js";
import { COMPLIANCE_PROGRAM_ID } from "./compliance";
import { type SeriesTerms, termsToFields } from "./series";

/** Sukuk units are whole numbers. */
export const SUKUK_DECIMALS = 0;

/** The token investors pay with and receive distributions in, e.g. USDC (legacy token program, 6 decimals). */
export interface PaymentToken {
  mint: PublicKey;
  decimals: number;
  programId: PublicKey;
}

export const ata = (mint: PublicKey, owner: PublicKey, programId: PublicKey = T22) =>
  getAssociatedTokenAddressSync(mint, owner, false, programId);

/**
 * Issue a sukuk series as a Token-2022 mint. Every holder account starts frozen until the compliance
 * authority approves it. The account is funded for the full terms; publish them next with `publishTermsIxs`.
 * Sign with issuer and mint.
 *
 * Duties are split across keys: `issuer` mints units and maintains the terms, `compliance` approves
 * and revokes investors. On mainnet each should be a multisig.
 */
export async function issueSeriesIxs(
  conn: Connection,
  p: { issuer: PublicKey; compliance: PublicKey; mint: PublicKey; terms: SeriesTerms },
): Promise<TransactionInstruction[]> {
  const { issuer, compliance, mint, terms } = p;
  const fields = termsToFields(terms);
  const mintLen = getMintLen([
    ExtensionType.MetadataPointer,
    ExtensionType.DefaultAccountState,
    ExtensionType.TransferHook,
    ExtensionType.PermanentDelegate,
  ]);
  const metaLen =
    TYPE_SIZE +
    LENGTH_SIZE +
    pack({ mint, name: terms.name, symbol: terms.symbol, uri: "", additionalMetadata: fields }).length;
  return [
    SystemProgram.createAccount({
      fromPubkey: issuer,
      newAccountPubkey: mint,
      space: mintLen,
      lamports: await conn.getMinimumBalanceForRentExemption(mintLen + metaLen),
      programId: T22,
    }),
    createInitializeMetadataPointerInstruction(mint, issuer, mint, T22),
    createInitializeDefaultAccountStateInstruction(mint, AccountState.Frozen, T22),
    // Every transfer calls the compliance program, which checks the recipient's record and the holding cap.
    createInitializeTransferHookInstruction(mint, compliance, COMPLIANCE_PROGRAM_ID, T22),
    // Lets the compliance authority move units without the holder's signature. Meant for lost keys, inheritance
    // and court or regulator orders only; see `forcedTransferIxs`.
    createInitializePermanentDelegateInstruction(mint, compliance, T22),
    createInitializeMintInstruction(mint, SUKUK_DECIMALS, issuer, compliance, T22),
    createInitializeInstruction({
      programId: T22,
      metadata: mint,
      updateAuthority: issuer,
      mint,
      mintAuthority: issuer,
      name: terms.name,
      symbol: terms.symbol,
      uri: "",
    }),
  ];
}

/**
 * Publish the series terms as metadata fields on the mint. Sent as its own transaction after
 * `issueSeriesIxs`, so issuance stays well under the transaction size limit as terms are added. Sign with issuer.
 */
export const publishTermsIxs = (issuer: PublicKey, mint: PublicKey, terms: SeriesTerms): TransactionInstruction[] =>
  termsToFields(terms).map(([field, value]) =>
    createUpdateFieldInstruction({ programId: T22, metadata: mint, updateAuthority: issuer, field, value }),
  );
