import { type Connection, type PublicKey, SystemProgram, type TransactionInstruction } from "@solana/web3.js";
import {
  AccountState, ExtensionType, LENGTH_SIZE, TOKEN_2022_PROGRAM_ID, TYPE_SIZE,
  createInitializeDefaultAccountStateInstruction, createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction, getAssociatedTokenAddressSync, getMintLen,
} from "@solana/spl-token";
import { createInitializeInstruction, createUpdateFieldInstruction, pack } from "@solana/spl-token-metadata";
import { type SeriesTerms, termsToFields } from "./series";

/** Sukuk units and rupiah are whole numbers. */
export const DECIMALS = 0;

export const ata = (mint: PublicKey, owner: PublicKey) =>
  getAssociatedTokenAddressSync(mint, owner, false, TOKEN_2022_PROGRAM_ID);

interface MintParams {
  payer: PublicKey;
  mint: PublicKey;
  authority: PublicKey;
  name: string;
  symbol: string;
  fields?: [string, string][];
  /** New token accounts start frozen until the authority thaws them. */
  frozenByDefault?: boolean;
}

/** Instructions that create a Token-2022 mint carrying its own metadata. Sign with payer and mint. */
export async function createMintIxs(conn: Connection, p: MintParams): Promise<TransactionInstruction[]> {
  const T22 = TOKEN_2022_PROGRAM_ID;
  const fields = p.fields ?? [];
  const exts = [ExtensionType.MetadataPointer, ...(p.frozenByDefault ? [ExtensionType.DefaultAccountState] : [])];
  const mintLen = getMintLen(exts);
  const metaLen =
    TYPE_SIZE + LENGTH_SIZE +
    pack({ mint: p.mint, name: p.name, symbol: p.symbol, uri: "", additionalMetadata: fields }).length;
  return [
    SystemProgram.createAccount({
      fromPubkey: p.payer,
      newAccountPubkey: p.mint,
      space: mintLen,
      lamports: await conn.getMinimumBalanceForRentExemption(mintLen + metaLen),
      programId: T22,
    }),
    createInitializeMetadataPointerInstruction(p.mint, p.authority, p.mint, T22),
    ...(p.frozenByDefault ? [createInitializeDefaultAccountStateInstruction(p.mint, AccountState.Frozen, T22)] : []),
    createInitializeMintInstruction(p.mint, DECIMALS, p.authority, p.authority, T22),
    createInitializeInstruction({
      programId: T22, metadata: p.mint, updateAuthority: p.authority, mint: p.mint, mintAuthority: p.authority,
      name: p.name, symbol: p.symbol, uri: "",
    }),
    ...fields.map(([field, value]) =>
      createUpdateFieldInstruction({ programId: T22, metadata: p.mint, updateAuthority: p.authority, field, value }),
    ),
  ];
}

/** Issue a sukuk series: terms live in the mint's metadata and every holder account is frozen until KYC. */
export const issueSeriesIxs = (conn: Connection, issuer: PublicKey, mint: PublicKey, terms: SeriesTerms) =>
  createMintIxs(conn, {
    payer: issuer, mint, authority: issuer,
    name: terms.name, symbol: terms.symbol, fields: termsToFields(terms), frozenByDefault: true,
  });
