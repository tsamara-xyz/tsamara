// End-to-end check in a real browser against devnet: connect, fund, get approved, subscribe, transfer.
// Needs the indexer, the API (without Sumsub, so the operator approves by hand) and the app running:
//   bun run indexer
//   SUMSUB_TOKEN= SUMSUB_SECRET= ADMIN_TOKEN=e2e bun run api
//   bun run --cwd apps/app build && bun run --cwd apps/app start
//   ADMIN_TOKEN=e2e bun apps/app/e2e/investor-flow.ts
import assert from "node:assert";
import { Keypair } from "@solana/web3.js";
import { chromium, type Page } from "playwright-core";

const APP = process.env.APP ?? "http://localhost:3000";
const INDEXER = process.env.INDEXER ?? "http://localhost:8787";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "";
const SLOW = { timeout: 90_000 }; // devnet confirmations plus public-RPC rate limits

const notice = (page: Page, text: string) => page.locator(".notice", { hasText: text }).waitFor(SLOW);
const step = (message: string) => console.log(`  ✓ ${message}`);

const browser = await chromium.launch({ channel: "chrome", headless: process.env.HEADED !== "1" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
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
  await page.locator(".big", { hasText: "$100.00" }).waitFor(SLOW);
  await page.getByRole("cell", { name: "GSD31" }).waitFor();
  step("portfolio shows $100.00 across 10 units");

  // Send one unit to another approved investor that has room under the cap.
  const holders = (await (await fetch(`${INDEXER}/holders`)).json()) as {
    wallet: string;
    units: string;
    approved: number;
  }[];
  const recipient = holders.find((h) => h.wallet !== address && h.approved === 1 && Number(h.units) < 90);
  assert.ok(recipient, "another approved investor exists to receive a transfer");
  await page.getByRole("link", { name: "Trade" }).click();
  await page.getByRole("button", { name: "Send" }).first().click();
  await page.getByPlaceholder("Registered investor's address").fill(recipient.wallet);
  await page.locator('form button[type="submit"]').click();
  await notice(page, "Transfer settled");
  step(`transferred 1 unit to ${recipient.wallet}`);

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
  await browser.close();
}
