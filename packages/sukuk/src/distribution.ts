import type { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { memoIx } from "./memo";
import type { PaymentToken } from "./mint";
import { periodicDistribution, type SeriesTerms } from "./series";
import { payIx } from "./settlement";

export interface Holding {
  owner: PublicKey;
  units: bigint;
}

/** One periodic distribution, paid from the issuer's treasury to each holder pro rata. Sign with issuer. */
// Everything in one transaction, without a period marker: fine for a handful of holders in a script.
// A service should use `distributionBatches`.
export function distributionIxs(payment: PaymentToken, issuer: PublicKey, holdings: Holding[], terms: SeriesTerms) {
  const payouts = holdings.map((h) => ({ owner: h.owner, amount: periodicDistribution(h.units, terms) }));
  const ixs = payouts.filter((p) => p.amount > 0n).map((p) => payIx(payment, issuer, p.owner, p.amount));
  return { ixs, payouts };
}

/** Transfers per transaction. Eight payouts and a memo stay well inside the transaction size limit. */
export const DISTRIBUTION_BATCH_SIZE = 8;

export const distributionMemo = (symbol: string, period: string, batch: number) =>
  `tsamara:distribution:${symbol}:${period}:${batch}`;

export interface DistributionBatch {
  /** Written onchain with the batch; a batch whose memo is already on the treasury's history has been paid. */
  memo: string;
  ixs: TransactionInstruction[];
  payouts: { owner: PublicKey; amount: bigint }[];
}

/**
 * One periodic distribution split into transactions, each marked with the period it pays.
 * Holders are ordered by address so the same holdings always produce the same batches, which is what
 * lets a failed run be resumed: pay only the batches whose memo is not onchain yet. Sign each with issuer.
 */
// ponytail: batches are cut from the holdings passed in. If holdings change between a failed run and its
// retry, batch boundaries can move; store the record-date snapshot before paying once a series has more
// holders than one batch.
export function distributionBatches(
  payment: PaymentToken,
  issuer: PublicKey,
  holdings: Holding[],
  terms: SeriesTerms,
  period: string,
  size = DISTRIBUTION_BATCH_SIZE,
): DistributionBatch[] {
  if (!/^[A-Za-z0-9-]{1,16}$/.test(period)) throw new Error("period must be 1 to 16 letters, digits or dashes");
  const payouts = holdings
    .map((h) => ({ owner: h.owner, amount: periodicDistribution(h.units, terms) }))
    .filter((p) => p.amount > 0n)
    // Plain code-unit order: localeCompare depends on the host's locale, and a retry must cut the same batches.
    .sort((a, b) => (a.owner.toBase58() < b.owner.toBase58() ? -1 : 1));
  const batches: DistributionBatch[] = [];
  for (let i = 0; i < payouts.length; i += size) {
    const slice = payouts.slice(i, i + size);
    const memo = distributionMemo(terms.symbol, period, batches.length);
    batches.push({
      memo,
      ixs: [memoIx(issuer, memo), ...slice.map((p) => payIx(payment, issuer, p.owner, p.amount))],
      payouts: slice,
    });
  }
  return batches;
}
