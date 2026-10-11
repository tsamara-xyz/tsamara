import type { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, createTransferCheckedInstruction } from "@solana/spl-token";
import { DECIMALS, ata } from "./mint";
import { type SeriesTerms, monthlyImbalan } from "./series";

export interface Holding {
  owner: PublicKey;
  units: bigint;
}

/** One month of imbalan, paid in rupiah from the issuer's treasury to each holder pro rata. Sign with issuer. */
// ponytail: caller passes the holder list and everything goes in one transaction (~10 holders);
// index holders with getProgramAccounts and batch transactions when a series has more.
export function imbalanIxs(idrMint: PublicKey, issuer: PublicKey, holdings: Holding[], terms: SeriesTerms) {
  const payouts = holdings.map((h) => ({ owner: h.owner, rupiah: monthlyImbalan(h.units, terms) }));
  const ixs = payouts
    .filter((p) => p.rupiah > 0n)
    .map((p) =>
      createTransferCheckedInstruction(
        ata(idrMint, issuer), idrMint, ata(idrMint, p.owner), issuer, p.rupiah, DECIMALS, [], TOKEN_2022_PROGRAM_ID,
      ),
    );
  return { ixs, payouts };
}
