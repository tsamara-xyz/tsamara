import {
  createFreezeAccountInstruction,
  createThawAccountInstruction,
  createTransferCheckedWithTransferHookInstruction,
  TOKEN_2022_PROGRAM_ID as T22,
  unpackAccount,
} from "@solana/spl-token";
import type { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { memoIx } from "./memo";
import { ata, SUKUK_DECIMALS } from "./mint";

/** Why units are being moved without their holder's signature. */
export interface ForcedTransferOrder {
  /** A short code, e.g. "lost-key", "inheritance", "court-order". */
  reason: string;
  /** The court, regulator or internal authority that ordered it, with a reference. */
  orderedBy: string;
}

/**
 * Move units from one investor to another on the compliance authority's signature alone, using the
 * mint's permanent delegate. Every use is recorded onchain: the first instruction is a memo naming the
 * reason and who ordered it, and it is rejected here if either is missing.
 *
 * The transfer hook still runs, so the recipient must be a registered investor within the holding cap.
 * A frozen source (a revoked investor) is thawed for the transfer and frozen again in the same
 * transaction: the permanent delegate does not override a freeze. Sign with the compliance authority.
 */
export async function forcedTransferIxs(
  conn: Connection,
  p: {
    sukukMint: PublicKey;
    from: PublicKey;
    to: PublicKey;
    units: bigint;
    compliance: PublicKey;
    order: ForcedTransferOrder;
  },
): Promise<TransactionInstruction[]> {
  const reason = p.order.reason.trim();
  const orderedBy = p.order.orderedBy.trim();
  if (!reason || !orderedBy) throw new Error("A forced transfer needs a reason and the authority that ordered it");
  const memo = JSON.stringify({ action: "forced-transfer", reason, orderedBy });
  const source = ata(p.sukukMint, p.from);
  const info = await conn.getAccountInfo(source, "confirmed");
  const frozen = info !== null && unpackAccount(source, info, T22).isFrozen;
  const transfer = await createTransferCheckedWithTransferHookInstruction(
    conn,
    source,
    p.sukukMint,
    ata(p.sukukMint, p.to),
    p.compliance,
    p.units,
    SUKUK_DECIMALS,
    [],
    "confirmed",
    T22,
  );
  if (!frozen) return [memoIx(p.compliance, memo), transfer];
  return [
    memoIx(p.compliance, memo),
    createThawAccountInstruction(source, p.sukukMint, p.compliance, [], T22),
    transfer,
    createFreezeAccountInstruction(source, p.sukukMint, p.compliance, [], T22),
  ];
}
