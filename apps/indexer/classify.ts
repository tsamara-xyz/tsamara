// Turns one parsed transaction into Tsamara events, using only token balance changes and instruction types.

export interface TokenBalance {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount: { amount: string };
}

/** The subset of a parsed Solana transaction the classifier reads. */
export interface Tx {
  signature: string;
  slot: number;
  blockTime: number | null;
  pre: TokenBalance[];
  post: TokenBalance[];
  /** Parsed instruction types in the transaction, e.g. "thawAccount". */
  instructionTypes: string[];
}

export interface Config {
  sukukMint: string;
  paymentMint: string;
  /** Owner of the treasury that receives subscriptions and pays distributions. */
  issuer: string;
}

export type Kind = "approved" | "revoked" | "subscription" | "trade" | "distribution";

export interface Event {
  signature: string;
  slot: number;
  time: number | null;
  kind: Kind;
  wallet: string;
  counterparty: string | null;
  /** Sukuk units moved (0 for approvals and distributions). */
  units: bigint;
  /** Payment-token base units moved. */
  amount: bigint;
}

/** Net change per owner for one mint. */
export function deltas(tx: Tx, mint: string): Map<string, bigint> {
  const d = new Map<string, bigint>();
  const add = (b: TokenBalance, sign: bigint) => {
    if (b.mint !== mint || !b.owner) return;
    d.set(b.owner, (d.get(b.owner) ?? 0n) + sign * BigInt(b.uiTokenAmount.amount));
  };
  tx.post.forEach((b) => add(b, 1n));
  tx.pre.forEach((b) => add(b, -1n));
  for (const [k, v] of d) if (v === 0n) d.delete(k);
  return d;
}

export function classify(tx: Tx, cfg: Config): Event[] {
  const base = { signature: tx.signature, slot: tx.slot, time: tx.blockTime };
  const sukuk = [...deltas(tx, cfg.sukukMint)];
  const paid = deltas(tx, cfg.paymentMint);
  const abs = (n: bigint) => (n < 0n ? -n : n);
  const gained = sukuk.filter(([, v]) => v > 0n);
  const lost = sukuk.filter(([, v]) => v < 0n);

  if (gained.length === 1 && lost.length === 1) {
    const [buyer, units] = gained[0]!;
    const [seller] = lost[0]!;
    return [{ ...base, kind: "trade", wallet: buyer, counterparty: seller, units, amount: abs(paid.get(buyer) ?? 0n) }];
  }
  if (gained.length === 1 && lost.length === 0) {
    const [investor, units] = gained[0]!;
    return [{ ...base, kind: "subscription", wallet: investor, counterparty: cfg.issuer, units, amount: abs(paid.get(investor) ?? 0n) }];
  }
  if (sukuk.length === 0 && (paid.get(cfg.issuer) ?? 0n) < 0n) {
    return [...paid]
      .filter(([owner, v]) => owner !== cfg.issuer && v > 0n)
      .map(([owner, v]) => ({ ...base, kind: "distribution" as const, wallet: owner, counterparty: cfg.issuer, units: 0n, amount: v }));
  }
  // Approvals and revocations move no tokens; the affected wallets are the sukuk accounts in the transaction.
  const kind = tx.instructionTypes.includes("thawAccount") ? "approved" : tx.instructionTypes.includes("freezeAccount") ? "revoked" : null;
  if (!kind) return [];
  const wallets = new Set(tx.post.filter((b) => b.mint === cfg.sukukMint && b.owner).map((b) => b.owner!));
  return [...wallets].map((wallet) => ({ ...base, kind, wallet, counterparty: null, units: 0n, amount: 0n }));
}
