// Routes anyone can call: read the series, get test funds, verify identity, subscribe.
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  TOKEN_2022_PROGRAM_ID as T22,
} from "@solana/spl-token";
import { LAMPORTS_PER_SOL, SystemProgram, Transaction } from "@solana/web3.js";
import { ata, COMPLIANCE_PROGRAM_ID, subscribeIxs } from "@tsamara/sukuk";
import { Hono } from "hono";
import { body, callerOf, fail, json, parseUnits, parseWallet, rateLimiter } from "../http";
import { accessToken, applicant, verdictOf } from "../kyc";
import { approveOnchain, holders, isRegistered, sukukBalance } from "../ledger";
import { conn, issuer, payment, send, sukukMint, terms } from "../series";
import { sumsubConfigured } from "../sumsub";

const FAUCET_USD = 1_000n;

export const investor = new Hono();

investor.get("/series", (c) =>
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

investor.get("/holders", async (c) => c.json(json(await holders())));

investor.get("/investors/:wallet", async (c) => {
  const wallet = parseWallet(c.req.param("wallet"));
  return c.json(json({ wallet, registered: await isRegistered(wallet), units: await sukukBalance(wallet) }));
});

// Demo convenience: open the investor's token accounts and give them mock dollars and a little SOL for fees.
// Every call costs the issuer rent and a little SOL, so it is limited per caller and refused for a funded wallet.
const faucetAllowed = rateLimiter(20, 3_600_000);
investor.post("/faucet", async (c) => {
  const wallet = parseWallet((await body(c)).wallet);
  if (!faucetAllowed(callerOf(c))) fail(429, "Too many faucet requests from this address; try again in an hour");
  const dollars = ata(payment.mint, wallet, payment.programId);
  const held = await conn.getTokenAccountBalance(dollars).then(
    (b) => BigInt(b.value.amount),
    () => 0n,
  );
  if (held >= FAUCET_USD * 10n ** BigInt(payment.decimals)) fail(422, "This wallet already has test dollars");
  const needsSol = (await conn.getBalance(wallet)) < 0.01 * LAMPORTS_PER_SOL;
  const signature = await send(
    [
      createAssociatedTokenAccountIdempotentInstruction(
        issuer.publicKey,
        dollars,
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
        dollars,
        issuer.publicKey,
        FAUCET_USD * 10n ** BigInt(payment.decimals),
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
investor.post("/subscribe", async (c) => {
  const data = await body(c);
  const wallet = parseWallet(data.wallet);
  const units = parseUnits(data.units);
  // The issuer already signs as issuer; as fee payer too, the transaction would need no one else's signature.
  if (wallet.equals(issuer.publicKey)) fail(400, "The issuer cannot subscribe to its own series");
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

investor.post("/kyc/token", async (c) => c.json({ token: await accessToken(parseWallet((await body(c)).wallet)) }));

// The browser calls this after the widget finishes. The verdict and the country are read from Sumsub
// server-side; nothing the browser says is trusted.
// ponytail: called on demand by the app; switch to the applicantReviewed webhook once the API has a public URL.
investor.post("/kyc/complete", async (c) => {
  const wallet = parseWallet((await body(c)).wallet);
  const verdict = verdictOf(await applicant(wallet).catch(() => fail(422, "No verification found for this address")));
  if (verdict.status !== "approved") return c.json(verdict);
  const { jurisdiction } = verdict;
  if (!jurisdiction) return fail(422, "Verification has no country on record");
  // An investor who is already registered is not thawed here: if the compliance authority froze the
  // account since, a still-green verification must not undo that. Re-approval is an operator action.
  if (await isRegistered(wallet)) return c.json({ status: "approved", jurisdiction });
  return c.json({ status: "approved", jurisdiction, signature: await approveOnchain({ wallet, jurisdiction }) });
});
