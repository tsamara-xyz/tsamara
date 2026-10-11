// Operator API: the server-side half of the app. It holds the issuer and compliance keys (devnet only),
// co-signs subscriptions, approves investors and pays distributions.
// Run from the repo root: bun run api
import { randomBytes } from "node:crypto";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { adminRoutes } from "./routes/admin";
import { investor } from "./routes/investor";
import { sukukMint } from "./series";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? randomBytes(12).toString("hex");

const app = new Hono();
app.use("*", cors());
app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: err instanceof Error ? err.message : "internal error" }, 500);
});
app.route("/", investor);
app.route("/admin", adminRoutes(ADMIN_TOKEN));

const server = Bun.serve({ port: Number(process.env.API_PORT ?? 8788), fetch: app.fetch });
console.log(`Operator API on http://localhost:${server.port} for series ${sukukMint.toBase58()}`);
console.log(`Admin token: ${ADMIN_TOKEN}`);
