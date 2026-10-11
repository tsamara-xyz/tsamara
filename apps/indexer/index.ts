// Indexes one sukuk series into SQLite and serves it over HTTP.
// Run from the repo root: bun run indexer            (poll and serve)
//                         bun run indexer --once     (index once, print holders, exit)
import { Connection, type ParsedTransactionWithMeta, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { ata } from "@tsamara/sukuk";
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { type Config, type Tx, classify, deltas } from "./classify";

const lastRun = existsSync(".keys/last-run.json") ? JSON.parse(readFileSync(".keys/last-run.json", "utf8")) : {};
const cfg: Config = {
  sukukMint: process.env.SUKUK_MINT ?? lastRun.sukukMint,
  paymentMint: process.env.PAYMENT_MINT ?? lastRun.paymentMint,
  issuer: process.env.ISSUER ?? lastRun.issuer,
};
if (!cfg.sukukMint || !cfg.paymentMint || !cfg.issuer) throw new Error("Set SUKUK_MINT, PAYMENT_MINT and ISSUER, or run `bun run demo` first");

const conn = new Connection(process.env.RPC ?? "https://api.devnet.solana.com", "confirmed");
// Every sukuk action references the mint; distributions only touch the treasury's payment account.
// ponytail: assumes the payment token is on the legacy token program (USDC); read the mint's owner if that changes.
const watched = [cfg.sukukMint, ata(new PublicKey(cfg.paymentMint), new PublicKey(cfg.issuer), TOKEN_PROGRAM_ID).toBase58()];

mkdirSync(".data", { recursive: true });
const db = new Database(`.data/indexer-${cfg.sukukMint}.db`);
db.run(`CREATE TABLE IF NOT EXISTS events (
  signature TEXT, slot INTEGER, time INTEGER, kind TEXT, wallet TEXT, counterparty TEXT, units TEXT, amount TEXT,
  PRIMARY KEY (signature, kind, wallet))`);
db.run("CREATE TABLE IF NOT EXISTS holders (wallet TEXT PRIMARY KEY, units TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT 0)");
db.run("CREATE TABLE IF NOT EXISTS seen (signature TEXT PRIMARY KEY)");
db.run("CREATE TABLE IF NOT EXISTS cursor (address TEXT PRIMARY KEY, signature TEXT NOT NULL)");

function toTx(signature: string, t: ParsedTransactionWithMeta): Tx {
  const ixs = [...t.transaction.message.instructions, ...(t.meta?.innerInstructions ?? []).flatMap((i) => i.instructions)];
  return {
    signature, slot: t.slot, blockTime: t.blockTime ?? null,
    pre: (t.meta?.preTokenBalances ?? []) as Tx["pre"],
    post: (t.meta?.postTokenBalances ?? []) as Tx["post"],
    instructionTypes: ixs.flatMap((ix) => ("parsed" in ix && ix.parsed?.type ? [ix.parsed.type as string] : [])),
  };
}

const holderUnits = (w: string) => BigInt((db.query("SELECT units FROM holders WHERE wallet = ?").get(w) as { units: string } | null)?.units ?? "0");

// Events and balance changes for one transaction are written together, exactly once.
const apply = db.transaction((tx: Tx) => {
  if (db.query("SELECT 1 FROM seen WHERE signature = ?").get(tx.signature)) return;
  db.run("INSERT INTO seen VALUES (?)", [tx.signature]);
  for (const e of classify(tx, cfg)) {
    db.run("INSERT OR IGNORE INTO events VALUES (?,?,?,?,?,?,?,?)", [e.signature, e.slot, e.time, e.kind, e.wallet, e.counterparty, String(e.units), String(e.amount)]);
    if (e.kind === "approved" || e.kind === "revoked")
      db.run("INSERT INTO holders (wallet, units, approved) VALUES (?, '0', ?) ON CONFLICT(wallet) DO UPDATE SET approved = excluded.approved", [e.wallet, e.kind === "approved" ? 1 : 0]);
  }
  for (const [wallet, d] of deltas(tx, cfg.sukukMint))
    db.run("INSERT INTO holders (wallet, units) VALUES (?, ?) ON CONFLICT(wallet) DO UPDATE SET units = excluded.units", [wallet, String(holderUnits(wallet) + d)]);
});

async function sync() {
  for (const address of watched) {
    const until = (db.query("SELECT signature FROM cursor WHERE address = ?").get(address) as { signature: string } | null)?.signature;
    // ponytail: one page of 1000 signatures per poll; page with `before` if a series ever gets busier than that between polls.
    const sigs = (await conn.getSignaturesForAddress(new PublicKey(address), { until })).filter((s) => !s.err).reverse();
    for (const { signature } of sigs) {
      const t = await conn.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
      if (t) apply(toTx(signature, t));
      db.run("INSERT INTO cursor VALUES (?, ?) ON CONFLICT(address) DO UPDATE SET signature = excluded.signature", [address, signature]);
    }
  }
}

const holders = () => db.query("SELECT wallet, units, approved FROM holders ORDER BY CAST(units AS INTEGER) DESC").all();
const events = (wallet: string | null) =>
  wallet
    ? db.query("SELECT * FROM events WHERE wallet = ?1 OR counterparty = ?1 ORDER BY slot DESC").all(wallet)
    : db.query("SELECT * FROM events ORDER BY slot DESC LIMIT 200").all();

await sync();
if (process.argv.includes("--once")) {
  console.table(holders());
  console.log(`${(db.query("SELECT COUNT(*) AS n FROM events").get() as { n: number }).n} events indexed`);
  process.exit(0);
}

setInterval(() => sync().catch((e) => console.error("sync failed:", e.message)), Number(process.env.POLL_MS ?? 5000));
const server = Bun.serve({
  port: Number(process.env.PORT ?? 8787),
  fetch(req) {
    const url = new URL(req.url);
    const json = (body: unknown) => Response.json(body, { headers: { "access-control-allow-origin": "*" } });
    if (url.pathname === "/series") return json(cfg);
    if (url.pathname === "/holders") return json(holders());
    if (url.pathname === "/events") return json(events(url.searchParams.get("wallet")));
    return new Response("not found", { status: 404 });
  },
});
console.log(`Indexing ${cfg.sukukMint}, serving on http://localhost:${server.port}`);
