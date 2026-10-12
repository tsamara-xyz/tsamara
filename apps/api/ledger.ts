// Reads and writes against the chain and the indexer for the live series.
import { TOKEN_2022_PROGRAM_ID as T22, unpackAccount } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { approveInvestorIxs, ata, type Investor, investorPda, isEligible, memoTexts } from "@tsamara/sukuk";
import { fail } from "./http";
import { compliance, conn, issuer, payment, send, sukukMint, terms } from "./series";

const INDEXER = process.env.INDEXER ?? "http://localhost:8787";

export async function sukukBalance(wallet: PublicKey): Promise<bigint> {
  const address = ata(sukukMint, wallet);
  const info = await conn.getAccountInfo(address);
  return info ? unpackAccount(address, info, T22).amount : 0n;
}

export const isRegistered = async (wallet: PublicKey) =>
  (await conn.getAccountInfo(investorPda(sukukMint, wallet))) !== null;

// The indexer is the holder registry: public RPC endpoints refuse to scan Token-2022 accounts by mint.
export async function holders() {
  const res = await fetch(`${INDEXER}/holders`).catch(() => null);
  if (!res?.ok) return fail(503, "The indexer is not reachable, so the holder list is unavailable");
  const rows = (await res.json()) as { wallet: string; units: string }[];
  return rows.filter((r) => r.units !== "0").map((r) => ({ owner: new PublicKey(r.wallet), units: BigInt(r.units) }));
}

/** Register the investor with the compliance program and open their account. Returns the signature. */
export async function approveOnchain(investor: Investor): Promise<string> {
  if (!/^[A-Z]{2}$/.test(investor.jurisdiction)) fail(400, "jurisdiction must be an ISO 3166-1 alpha-2 code");
  if (!isEligible(investor.jurisdiction, terms))
    fail(422, `${terms.symbol} is not offered to residents of ${investor.jurisdiction}`);
  if (!(await conn.getAccountInfo(ata(sukukMint, investor.wallet))))
    fail(422, "Investor has no sukuk account yet; use the faucet first");
  const ixs = approveInvestorIxs({
    sukukMint,
    investor,
    payer: issuer.publicKey,
    compliance: compliance.publicKey,
    terms,
  });
  // Already registered (for example re-approving after a revocation): only thaw the account.
  return send((await isRegistered(investor.wallet)) ? ixs.slice(1) : ixs, [issuer, compliance]);
}

/**
 * Whether a distribution batch has been paid: a successful treasury transaction carries exactly this memo
 * and was signed by the issuer. Anyone can send dust to the treasury with any memo, so the memo alone
 * proves nothing.
 */
// ponytail: the last 1000 treasury transactions; page further back once a series has that much history.
export async function paidBatches(): Promise<(memo: string) => Promise<boolean>> {
  const treasury = ata(payment.mint, issuer.publicKey, payment.programId);
  const history = (await conn.getSignaturesForAddress(treasury, { limit: 1000 })).filter((s) => !s.err);
  return async (memo) => {
    for (const { signature } of history.filter((s) => memoTexts(s.memo).includes(memo))) {
      const tx = await conn.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
      if (tx?.transaction.message.accountKeys.some((k) => k.signer && k.pubkey.equals(issuer.publicKey))) return true;
    }
    return false;
  };
}
