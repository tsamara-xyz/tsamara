// Operator-only routes, behind the admin token.

import { timingSafeEqual } from "node:crypto";
import { distributionBatches, forcedTransferIxs } from "@tsamara/sukuk";
import { Hono } from "hono";
import { body, fail, json, parseUnits, parseWallet } from "../http";
import { applicant, sandboxReview } from "../kyc";
import { approveOnchain, holders, paidBatches } from "../ledger";
import { compliance, conn, issuer, payment, send, sukukMint, terms } from "../series";

export function adminRoutes(adminToken: string): Hono {
  const admin = new Hono();

  admin.use("*", async (c, next) => {
    const given = Buffer.from(c.req.header("x-admin-token") ?? "");
    const expected = Buffer.from(adminToken);
    if (!adminToken || given.length !== expected.length || !timingSafeEqual(given, expected))
      fail(401, "admin token required");
    await next();
  });

  // Manual approval by the operator, used when no KYC provider is configured.
  admin.post("/kyc", async (c) => {
    const data = await body(c);
    const jurisdiction = String(data.jurisdiction ?? "").toUpperCase();
    return c.json({ signature: await approveOnchain({ wallet: parseWallet(data.wallet), jurisdiction }) });
  });

  admin.post("/kyc/sandbox-review", async (c) => {
    const data = await body(c);
    const { id } = await applicant(parseWallet(data.wallet)).catch(() =>
      fail(422, "No verification found for this address"),
    );
    const reviewAnswer = data.answer === "RED" ? "RED" : "GREEN";
    await sandboxReview(id, reviewAnswer);
    return c.json({ reviewAnswer });
  });

  // Pays one period's distribution in batches. Each batch carries a memo naming the period, and a batch
  // whose memo is already on the treasury's history is skipped, so repeating a period pays nobody twice.
  // One run at a time: two runs would both read the history before either had paid.
  let distributing = false;
  admin.post("/distribute", async (c) => {
    const period = String((await body(c)).period ?? "");
    if (!/^[A-Za-z0-9-]{1,16}$/.test(period)) fail(400, "period is required: 1 to 16 letters, digits or dashes");
    if (distributing) fail(409, "A distribution is already running; wait for it to finish");
    distributing = true;
    try {
      const batches = distributionBatches(payment, issuer.publicKey, await holders(), terms, period);
      if (batches.length === 0) fail(422, "No holders to pay");
      const isPaid = await paidBatches();
      const results = [];
      for (const batch of batches) {
        if (await isPaid(batch.memo)) {
          results.push({ memo: batch.memo, skipped: true, signature: null });
          continue;
        }
        // One failing batch (a holder who closed their dollar account, say) must not stop the others.
        const outcome = await send(batch.ixs, [issuer]).then(
          (signature) => ({ signature }),
          (e: Error) => ({ signature: null, error: e.message }),
        );
        results.push({ memo: batch.memo, skipped: false, ...outcome });
      }
      return c.json(json({ period, batches: results, payouts: batches.flatMap((b) => b.payouts) }));
    } finally {
      distributing = false;
    }
  });

  // Moves units without the holder's signature. For lost keys, inheritance and court or regulator orders;
  // the reason and the ordering authority are written onchain with the transfer.
  admin.post("/forced-transfer", async (c) => {
    const data = await body(c);
    const order = { reason: String(data.reason ?? ""), orderedBy: String(data.orderedBy ?? "") };
    if (!order.reason.trim() || !order.orderedBy.trim()) fail(400, "reason and orderedBy are required");
    const ixs = await forcedTransferIxs(conn, {
      sukukMint,
      from: parseWallet(data.from),
      to: parseWallet(data.to),
      units: parseUnits(data.units),
      compliance: compliance.publicKey,
      order,
    });
    return c.json({ signature: await send(ixs, [issuer, compliance]) });
  });

  return admin;
}
