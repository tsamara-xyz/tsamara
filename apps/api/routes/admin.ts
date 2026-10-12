// Operator-only routes, behind the admin token.
import { distributionBatches, forcedTransferIxs } from "@tsamara/sukuk";
import { Hono } from "hono";
import { fail, json, parseUnits, parseWallet } from "../http";
import { applicant, sandboxReview } from "../kyc";
import { approveOnchain, holders, paidMemos } from "../ledger";
import { compliance, conn, issuer, payment, send, sukukMint, terms } from "../series";

export function adminRoutes(adminToken: string): Hono {
  const admin = new Hono();

  admin.use("*", async (c, next) => {
    if (c.req.header("x-admin-token") !== adminToken) fail(401, "admin token required");
    await next();
  });

  // Manual approval by the operator, used when no KYC provider is configured.
  admin.post("/kyc", async (c) => {
    const body = await c.req.json();
    const jurisdiction = String(body.jurisdiction ?? "").toUpperCase();
    return c.json({ signature: await approveOnchain({ wallet: parseWallet(body.wallet), jurisdiction }) });
  });

  admin.post("/kyc/sandbox-review", async (c) => {
    const body = await c.req.json();
    const { id } = await applicant(parseWallet(body.wallet)).catch(() =>
      fail(422, "No verification found for this address"),
    );
    const reviewAnswer = body.answer === "RED" ? "RED" : "GREEN";
    await sandboxReview(id, reviewAnswer);
    return c.json({ reviewAnswer });
  });

  // Pays one period's distribution in batches. Each batch carries a memo naming the period, and a batch
  // whose memo is already on the treasury's history is skipped, so repeating a period pays nobody twice.
  admin.post("/distribute", async (c) => {
    const period = String((await c.req.json().catch(() => ({}))).period ?? "");
    if (!/^[A-Za-z0-9-]{1,16}$/.test(period)) fail(400, "period is required: 1 to 16 letters, digits or dashes");
    const batches = distributionBatches(payment, issuer.publicKey, await holders(), terms, period);
    if (batches.length === 0) fail(422, "No holders to pay");
    const paid = await paidMemos();
    const results = [];
    for (const batch of batches) {
      const done = paid.some((memo) => memo.includes(batch.memo));
      results.push({ memo: batch.memo, skipped: done, signature: done ? null : await send(batch.ixs, [issuer]) });
    }
    return c.json(json({ period, batches: results, payouts: batches.flatMap((b) => b.payouts) }));
  });

  // Moves units without the holder's signature. For lost keys, inheritance and court or regulator orders;
  // the reason and the ordering authority are written onchain with the transfer.
  admin.post("/forced-transfer", async (c) => {
    const body = await c.req.json();
    const order = { reason: String(body.reason ?? ""), orderedBy: String(body.orderedBy ?? "") };
    if (!order.reason.trim() || !order.orderedBy.trim()) fail(400, "reason and orderedBy are required");
    const ixs = await forcedTransferIxs(conn, {
      sukukMint,
      from: parseWallet(body.from),
      to: parseWallet(body.to),
      units: parseUnits(body.units),
      compliance: compliance.publicKey,
      order,
    });
    return c.json({ signature: await send(ixs, [issuer, compliance]) });
  });

  return admin;
}
