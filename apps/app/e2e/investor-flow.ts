// End-to-end check in a real browser against devnet: connect, fund, get approved, subscribe, transfer.
// Needs the indexer, the API (without Sumsub, so the operator approves by hand) and the app running:
//   bun run indexer
//   SUMSUB_TOKEN= SUMSUB_SECRET= ADMIN_TOKEN=e2e bun run api
//   bun run --cwd apps/app build && bun run --cwd apps/app start
//   ADMIN_TOKEN=e2e bun apps/app/e2e/investor-flow.ts
// Add RECORD=<directory> to save a video of the run.
import assert from "node:assert";
import { Keypair } from "@solana/web3.js";
import { chromium, type Page } from "playwright-core";

const APP = process.env.APP ?? "http://localhost:3000";
const API = process.env.API ?? "http://localhost:8788";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "";
const SLOW = { timeout: 90_000 }; // devnet confirmations plus public-RPC rate limits

const notice = (page: Page, text: string) => page.locator(".notice", { hasText: text }).waitFor(SLOW);
const step = (message: string) => console.log(`  ✓ ${message}`);

async function call(path: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(API + path, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  assert.ok(res.ok, `${path} failed: ${await res.text()}`);
}

// RECORD=<directory> saves a video of the run, slowed down enough to follow; useful as raw footage for a demo.
const RECORD = process.env.RECORD;
const browser = await chromium.launch({
  channel: "chrome",
  headless: process.env.HEADED !== "1",
  slowMo: RECORD ? 700 : 0,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  ...(RECORD ? { recordVideo: { dir: RECORD, size: { width: 1440, height: 900 } } } : {}),
});
const page = await context.newPage();
const failures: string[] = [];
page.on("pageerror", (e) => failures.push(`page error: ${e.message}`));

try {
  await page.goto(APP);
  await page.getByRole("heading", { name: "Sovereign Sukuk in $10 Units" }).waitFor();
  await page.getByRole("button", { name: "Connect" }).click();
  const address = await page.locator(".chip[title]").getAttribute("title");
  assert.ok(address, "the connected wallet's address is shown");
  step(`test wallet connected: ${address}`);

  await page.getByRole("link", { name: "Invest now" }).click();
  await page.getByRole("heading", { name: "Global Sukuk Demo 2031" }).waitFor();
  await page.getByRole("button", { name: "Get $1,000 test dollars" }).click();
  await notice(page, "Test dollars received");
  await page.getByRole("button", { name: "Awaiting operator approval" }).waitFor(SLOW);
  step("faucet funded the wallet; the panel now asks for approval");

  await page.getByRole("link", { name: "Operator" }).click();
  await page.locator('input[type="password"]').fill(ADMIN_TOKEN);
  await page.getByLabel("Investor address").fill(address);
  await page.getByLabel("Country code").fill("AE");
  await page.getByRole("button", { name: "Approve" }).click();
  await notice(page, "Investor approved");
  step("operator approved the investor onchain");

  await page.getByRole("link", { name: "Explore" }).click();
  await page.getByRole("link", { name: "Invest now" }).click();
  await page.getByRole("spinbutton").fill("10");
  await page.getByRole("button", { name: "Subscribe" }).click();
  await notice(page, "Subscription settled");
  step("subscribed to 10 units");

  await page.getByRole("link", { name: "Portfolio" }).click();
  const holding = page.locator(".tile.sukuk");
  await holding.filter({ hasText: "10 units" }).filter({ hasText: "$100.00" }).waitFor(SLOW);
  await page.locator(".figure", { hasText: "$1,000" }).first().waitFor();
  step("portfolio shows 10 units worth $100.00 and $1,000.00 in total");

  // A second approved investor to receive a transfer, set up through the API.
  const recipient = Keypair.generate().publicKey.toBase58();
  await call("/faucet", { wallet: recipient });
  await call("/admin/kyc", { wallet: recipient, jurisdiction: "DE" }, { "x-admin-token": ADMIN_TOKEN });
  await holding.click();
  await page.getByRole("button", { name: "Send" }).first().click();
  await page.getByPlaceholder("Registered investor's address").fill(recipient);
  await page.locator('form button[type="submit"]').click();
  await notice(page, "Transfer settled");
  step(`transferred 1 unit to ${recipient}`);

  // A transfer to a wallet that never passed KYC must be explained, not shown as a raw program error.
  await page.getByPlaceholder("Registered investor's address").fill(Keypair.generate().publicKey.toBase58());
  await page.locator('form button[type="submit"]').click();
  await page.locator(".notice.error", { hasText: "no sukuk account" }).waitFor(SLOW);
  step("transfer to a wallet that never onboarded is refused with an explanation");

  assert.deepEqual(failures, [], "no uncaught errors in the page");
  console.log("Investor flow passed.");
} catch (e) {
  await page.screenshot({ path: "e2e-failure.png", fullPage: true });
  console.error("Investor flow FAILED; screenshot saved to e2e-failure.png");
  console.error(failures.join("\n"));
  throw e;
} finally {
  await context.close();
  await browser.close();
  if (RECORD) console.log(`Video saved to ${await page.video()?.path()}`);
}
