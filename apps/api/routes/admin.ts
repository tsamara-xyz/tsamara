// Operator-only routes, behind the admin token.
import { distributionIxs } from "@tsamara/sukuk";
import { Hono } from "hono";
import { fail, json, parseWallet } from "../http";
import { applicant, sandboxReview } from "../kyc";
import { approveOnchain, holders } from "../ledger";
import { issuer, payment, send, terms } from "../series";

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

  admin.post("/distribute", async (c) => {
    const { ixs, payouts } = distributionIxs(payment, issuer.publicKey, await holders(), terms);
    if (ixs.length === 0) fail(422, "No holders to pay");
    return c.json(json({ signature: await send(ixs, [issuer]), payouts }));
  });

  return admin;
}
