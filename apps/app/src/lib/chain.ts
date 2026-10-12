// Everything the UI needs from the operator API, the indexer and the chain.
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { ata, type PaymentToken, transferIx } from "@tsamara/sukuk";

// `||`, not `??`: a build that passes an unset variable through leaves an empty string, which must fall back too.
const API = process.env.NEXT_PUBLIC_API || "http://localhost:8788";
const INDEXER = process.env.NEXT_PUBLIC_INDEXER || "http://localhost:8787";
export const conn = new Connection(process.env.NEXT_PUBLIC_RPC || "https://api.devnet.solana.com", "confirmed");

export interface Series {
  sukukMint: string;
  paymentMint: string;
  paymentDecimals: number;
  issuer: string;
  complianceProgram: string;
  kyc: "sumsub" | "manual";
  terms: {
    name: string;
    symbol: string;
    akad: string;
    maturity: string;
    currency: string;
    expectedProfitRateBps: number;
    paymentsPerYear: number;
    unitValue: string;
    restrictedJurisdictions: string[];
    maxHolding: string;
    tangibleAssetsBps: number;
    tangibilityAsOf: string;
  };
}

export interface ChainEvent {
  signature: string;
  time: number | null;
  kind: "approved" | "revoked" | "subscription" | "trade" | "distribution";
  wallet: string;
  counterparty: string | null;
  units: string;
  amount: string;
}

export interface Holder {
  wallet: string;
  units: string;
  approved: number;
}

async function request<T>(base: string, path: string, body?: unknown, adminToken?: string): Promise<T> {
  const res = await fetch(base + path, {
    method: body ? "POST" : "GET",
    // No content-type on GET: it would turn a simple request into a CORS preflight, which the indexer does not answer.
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(adminToken ? { "x-admin-token": adminToken } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => {
    throw new Error(`Cannot reach ${base}. Is the service running?`);
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  series: () => request<Series>(API, "/series"),
  investor: (wallet: string) => request<{ registered: boolean; units: string }>(API, `/investors/${wallet}`),
  faucet: (wallet: string) => request<{ signature: string }>(API, "/faucet", { wallet }),
  subscribe: (wallet: string, units: number) => request<{ transaction: string }>(API, "/subscribe", { wallet, units }),
  kycToken: (wallet: string) => request<{ token: string }>(API, "/kyc/token", { wallet }),
  kycComplete: (wallet: string) =>
    request<{
      status: "pending" | "approved" | "rejected";
      jurisdiction?: string;
      reason?: string;
      signature?: string;
    }>(API, "/kyc/complete", { wallet }),
  forcedTransfer: (
    token: string,
    order: { from: string; to: string; units: number; reason: string; orderedBy: string },
  ) => request<{ signature: string }>(API, "/admin/forced-transfer", order, token),
  sandboxReview: (token: string, wallet: string) =>
    request<{ reviewAnswer: string }>(API, "/admin/kyc/sandbox-review", { wallet }, token),
  kyc: (token: string, wallet: string, jurisdiction: string) =>
    request<{ signature: string }>(API, "/admin/kyc", { wallet, jurisdiction }, token),
  distribute: (token: string, period: string) =>
    request<{ batches: { memo: string; skipped: boolean; signature: string | null; error?: string }[] }>(
      API,
      "/admin/distribute",
      { period },
      token,
    ),
  holders: () => request<Holder[]>(INDEXER, "/holders"),
  events: (wallet?: string) => request<ChainEvent[]>(INDEXER, wallet ? `/events?wallet=${wallet}` : "/events"),
};

/** A connected wallet: Phantom, or a throwaway key kept in this browser. */
export interface Wallet {
  kind: "phantom" | "burner";
  publicKey: PublicKey;
  sign(tx: Transaction): Promise<Transaction>;
}

interface PhantomProvider {
  connect(): Promise<{ publicKey: { toString(): string } }>;
  signTransaction(tx: Transaction): Promise<Transaction>;
}

// ponytail: Phantom and a burner key only; add the Wallet Standard adapter when other wallets matter.
export async function connectPhantom(): Promise<Wallet> {
  const provider = (window as { phantom?: { solana?: PhantomProvider } }).phantom?.solana;
  if (!provider)
    throw new Error(
      "Phantom is not installed. Use the test wallet instead, or install Phantom and switch it to devnet.",
    );
  const { publicKey } = await provider.connect();
  return {
    kind: "phantom",
    publicKey: new PublicKey(publicKey.toString()),
    sign: (tx) => provider.signTransaction(tx),
  };
}

/** A devnet-only key stored in localStorage so anyone can try the app without a wallet. Never use it for real funds. */
export function burnerWallet(): Wallet {
  const saved = localStorage.getItem("tsamara-burner");
  const keypair = saved ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(saved))) : Keypair.generate();
  if (!saved) localStorage.setItem("tsamara-burner", JSON.stringify([...keypair.secretKey]));
  return {
    kind: "burner",
    publicKey: keypair.publicKey,
    sign: async (tx) => {
      tx.partialSign(keypair);
      return tx;
    },
  };
}

async function signAndSend(wallet: Wallet, tx: Transaction): Promise<string> {
  const signed = await wallet.sign(tx);
  const signature = await conn.sendRawTransaction(signed.serialize());
  await conn.confirmTransaction(signature, "confirmed");
  return signature;
}

export async function subscribe(wallet: Wallet, units: number): Promise<string> {
  const { transaction } = await api.subscribe(wallet.publicKey.toBase58(), units);
  return signAndSend(wallet, Transaction.from(Buffer.from(transaction, "base64")));
}

export async function transfer(wallet: Wallet, series: Series, to: string, units: number): Promise<string> {
  const tx = new Transaction().add(
    await transferIx(conn, new PublicKey(series.sukukMint), wallet.publicKey, new PublicKey(to), BigInt(units)),
  );
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  return signAndSend(wallet, tx);
}

export async function dollarBalance(wallet: PublicKey, payment: PaymentToken): Promise<bigint> {
  const balance = await conn.getTokenAccountBalance(ata(payment.mint, wallet, payment.programId)).catch(() => null);
  return BigInt(balance?.value.amount ?? "0");
}

/** Turn program and RPC errors into something an investor can act on. */
export function explain(error: unknown): string {
  const text =
    String((error as { logs?: string[] })?.logs ?? "") + String(error instanceof Error ? error.message : error);
  if (/HoldingCapExceeded|0x1773/.test(text)) return "Rejected onchain: the recipient would exceed the holding cap.";
  if (/RestrictedJurisdiction|0x1772/.test(text))
    return "Rejected onchain: the series is not offered in that jurisdiction.";
  if (/frozen|0x11\b/i.test(text)) return "Rejected onchain: that wallet has not passed KYC, so its account is frozen.";
  if (/AccountNotInitialized|0xbc4/.test(text)) return "Rejected onchain: the recipient is not a registered investor.";
  if (/insufficient funds|0x1\b/.test(text)) return "Not enough balance for this transaction.";
  if (/User rejected/i.test(text)) return "You cancelled the request in your wallet.";
  // spl-token throws these with an empty message when the recipient never opened a sukuk account.
  if (error instanceof Error && /Account(Data)?NotFound/.test(error.name))
    return "That wallet has no sukuk account, so it cannot receive units. The recipient must onboard first.";
  if (error instanceof Error && error.name === "TokenOwnerOffCurveError")
    return "That address belongs to a program, not a wallet, so it cannot hold units.";
  if (/Non-base58|Invalid public key/i.test(text)) return "That is not a valid wallet address.";
  const message = error instanceof Error ? error.message : String(error);
  return message || "The request failed without an error message.";
}

export const explorer = (signature: string) => `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
export const short = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;
export const usd = (baseUnits: string | bigint, decimals = 6) =>
  `$${(Number(baseUnits) / 10 ** decimals).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
