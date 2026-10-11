import type { PublicKey } from "@solana/web3.js";
import type { PaymentToken } from "./mint";
import { type SeriesTerms, periodicDistribution } from "./series";
import { payIx } from "./settlement";

export interface Holding {
  owner: PublicKey;
  units: bigint;
}

/** One periodic distribution, paid from the issuer's treasury to each holder pro rata. Sign with issuer. */
// ponytail: caller passes the holder list and everything goes in one transaction (~10 holders);
// index holders with getProgramAccounts and batch transactions when a series has more.
export function distributionIxs(payment: PaymentToken, issuer: PublicKey, holdings: Holding[], terms: SeriesTerms) {
  const payouts = holdings.map((h) => ({ owner: h.owner, amount: periodicDistribution(h.units, terms) }));
  const ixs = payouts.filter((p) => p.amount > 0n).map((p) => payIx(payment, issuer, p.owner, p.amount));
  return { ixs, payouts };
}
