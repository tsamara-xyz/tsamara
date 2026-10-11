// Operator API: the server-side half of the app. It holds the issuer and compliance keys (devnet only),
// co-signs subscriptions, approves investors and pays distributions.
// Run from the repo root: bun run api

import { randomBytes } from "node:crypto";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  TOKEN_2022_PROGRAM_ID as T22,
  unpackAccount,
} from "@solana/spl-token";
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  approveInvestorIxs,
  ata,
  COMPLIANCE_PROGRAM_ID,
  distributionIxs,
  investorPda,
  isEligible,
  subscribeIxs,
} from "@tsamara/sukuk";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import countries from "i18n-iso-countries";
import { compliance, conn, issuer, payment, send, sukukMint, terms } from "./series";
import { LEVEL, sumsub, sumsubConfigured } from "./sumsub";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? randomBytes(12).toString("hex");
const INDEXER = process.env.INDEXER ?? "http://localhost:8787";
const FAUCET_USD = 1_000n;
const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
const fail = (status: 400 | 401 | 422 | 503, message: string): never => {
  throw new HTTPException(status, { message });
};

function parseWallet(value: unknown): PublicKey {
  try {
    return new PublicKey(String(value));
  } catch {
    return fail(400, "wallet is not a valid address");
  }
}

function parseUnits(value: unknown): bigint {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0 || n > 1_000_000) fail(400, "units must be a positive whole number");
  return BigInt(n);
}

const sukukBalance = async (wallet: PublicKey) => {
  const info = await conn.getAccountInfo(ata(sukukMint, wallet));
  return info ? unpackAccount(ata(sukukMint, wallet), info, T22).amount : 0n;
};

// The indexer is the holder registry: public RPC endpoints refuse to scan Token-2022 accounts by mint.
async function holders() {
  const res = await fetch(`${INDEXER}/holders`).catch(() => null);
  if (!res?.ok) return fail(503, `Indexer is not reachable at ${INDEXER}; start it with \`bun run indexer\``);
  const rows = (await res.json()) as { wallet: string; units: string }[];
  return rows.filter((r) => r.units !== "0").map((r) => ({ owner: new PublicKey(r.wallet), units: BigInt(r.units) }));
}

const app = new Hono();
app.use("*", cors());
app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: err instanceof Error ? err.message : "internal error" }, 500);
});
const admin = new Hono();
admin.use("*", async (c, next) => {
  if (c.req.header("x-admin-token") !== ADMIN_TOKEN) fail(401, "admin token required");
  await next();
});

app.get("/series", (c) =>
  c.json(
    json({
      sukukMint,
      paymentMint: payment.mint,
      paymentDecimals: payment.decimals,
      issuer: issuer.publicKey,
      complianceProgram: COMPLIANCE_PROGRAM_ID,
      kyc: sumsubConfigured ? "sumsub" : "manual",
      terms,
    }),
  ),
);

app.get("/holders", async (c) => c.json(json(await holders())));

app.get("/investors/:wallet", async (c) => {
  const wallet = parseWallet(c.req.param("wallet"));
  const registered = (await conn.getAccountInfo(investorPda(sukukMint, wallet))) !== null;
  return c.json(json({ wallet, registered, units: await sukukBalance(wallet) }));
});

// Demo convenience: open the investor's token accounts and give them mock dollars and a little SOL for fees.
app.post("/faucet", async (c) => {
  const wallet = parseWallet((await c.req.json()).wallet);
  const needsSol = (await conn.getBalance(wallet)) < 0.01 * LAMPORTS_PER_SOL;
  const signature = await send(
    [
      createAssociatedTokenAccountIdempotentInstruction(
        issuer.publicKey,
        ata(payment.mint, wallet, payment.programId),
        wallet,
        payment.mint,
        payment.programId,
      ),
      createAssociatedTokenAccountIdempotentInstruction(
        issuer.publicKey,
        ata(sukukMint, wallet),
        wallet,
        sukukMint,
        T22,
      ),
      createMintToInstruction(
        payment.mint,
        ata(payment.mint, wallet, payment.programId),
        issuer.publicKey,
        FAUCET_USD * 1_000_000n,
        [],
        payment.programId,
      ),
      ...(needsSol
        ? [
            SystemProgram.transfer({
              fromPubkey: issuer.publicKey,
              toPubkey: wallet,
              lamports: 0.02 * LAMPORTS_PER_SOL,
            }),
          ]
        : []),
    ],
    [issuer],
  );
  return c.json({ signature, usd: FAUCET_USD.toString() });
});

// Returns a subscription transaction signed by the issuer; the investor signs and sends it.
app.post("/subscribe", async (c) => {
  const body = await c.req.json();
  const wallet = parseWallet(body.wallet);
  const units = parseUnits(body.units);
  // The transfer hook does not run on mint, so the holding cap is checked here before the issuer co-signs.
  const held = await sukukBalance(wallet);
  if (held + units > terms.maxHolding)
    fail(422, `Holding cap is ${terms.maxHolding} units; this wallet already holds ${held}`);
  const tx = new Transaction().add(
    ...subscribeIxs({ sukukMint, payment, issuer: issuer.publicKey, investor: wallet, units, terms }),
  );
  tx.feePayer = wallet;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  tx.partialSign(issuer);
  return c.json({ transaction: tx.serialize({ requireAllSignatures: false }).toString("base64") });
});

// Register the investor with the compliance program and open their account.
async function approveOnchain(investor: { wallet: PublicKey; jurisdiction: string }) {
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
  const registered = (await conn.getAccountInfo(investorPda(sukukMint, investor.wallet))) !== null;
  return send(registered ? ixs.slice(1) : ixs, [issuer, compliance]);
}

interface Applicant {
  id: string;
  info?: { country?: string; idDocs?: { country?: string }[] };
  fixedInfo?: { country?: string };
  review?: { reviewStatus?: string; reviewResult?: { reviewAnswer?: string; rejectLabels?: string[] } };
}

// The wallet address is the applicant's stable id at the KYC provider.
const applicant = (wallet: PublicKey) =>
  sumsub<Applicant>("GET", `/resources/applicants/-;externalUserId=${wallet.toBase58()}/one`);

// ponytail: anyone can start verification for any address; require a wallet signature over a nonce
// before minting the token once this is more than a sandbox.
app.post("/kyc/token", async (c) => {
  const wallet = parseWallet((await c.req.json()).wallet);
  const path = `/resources/accessTokens?userId=${wallet.toBase58()}&levelName=${encodeURIComponent(LEVEL)}&ttlInSecs=600`;
  return c.json({ token: (await sumsub<{ token: string }>("POST", path)).token });
});

// The browser calls this after the widget finishes. The verdict and the country are read from Sumsub
// server-side; nothing the browser says is trusted.
// ponytail: called on demand by the app; switch to the applicantReviewed webhook once the API has a public URL.
app.post("/kyc/complete", async (c) => {
  const wallet = parseWallet((await c.req.json()).wallet);
  const { info, fixedInfo, review } = await applicant(wallet).catch(() =>
    fail(422, "No verification found for this address"),
  );
  if (review?.reviewStatus !== "completed") return c.json({ status: "pending" });
  if (review.reviewResult?.reviewAnswer !== "GREEN")
    return c.json({ status: "rejected", reason: review.reviewResult?.rejectLabels?.join(", ") || "not approved" });
  // Sumsub reports ISO alpha-3. With an identity-document level this is the document's country,
  // not proven residence; add a proof-of-address step before relying on it as residence.
  const alpha3 = info?.country ?? info?.idDocs?.[0]?.country ?? fixedInfo?.country;
  const jurisdiction = alpha3 ? countries.alpha3ToAlpha2(alpha3) : undefined;
  if (!jurisdiction) return fail(422, "Verification has no country on record");
  return c.json({ status: "approved", jurisdiction, signature: await approveOnchain({ wallet, jurisdiction }) });
});

// Manual approval by the operator, used when no KYC provider is configured.
admin.post("/kyc", async (c) => {
  const body = await c.req.json();
  const investor = { wallet: parseWallet(body.wallet), jurisdiction: String(body.jurisdiction ?? "").toUpperCase() };
  return c.json({ signature: await approveOnchain(investor) });
});

// Sandbox only: stand in for Sumsub's reviewer so a demo does not wait on a human.
admin.post("/kyc/sandbox-review", async (c) => {
  const body = await c.req.json();
  const { id } = await applicant(parseWallet(body.wallet)).catch(() =>
    fail(422, "No verification found for this address"),
  );
  const reviewAnswer = body.answer === "RED" ? "RED" : "GREEN";
  await sumsub("POST", `/resources/applicants/${id}/status/testCompleted`, {
    reviewAnswer,
    rejectLabels: reviewAnswer === "RED" ? ["FRAUDULENT_PATTERNS"] : [],
    ...(reviewAnswer === "RED" ? { reviewRejectType: "FINAL" } : {}),
  });
  return c.json({ reviewAnswer });
});

admin.post("/distribute", async (c) => {
  const { ixs, payouts } = distributionIxs(payment, issuer.publicKey, await holders(), terms);
  if (ixs.length === 0) fail(422, "No holders to pay");
  return c.json(json({ signature: await send(ixs, [issuer]), payouts }));
});

app.route("/admin", admin);

const server = Bun.serve({ port: Number(process.env.API_PORT ?? 8788), fetch: app.fetch });
console.log(`Operator API on http://localhost:${server.port} for series ${sukukMint.toBase58()}`);
console.log(`Admin token: ${ADMIN_TOKEN}`);
