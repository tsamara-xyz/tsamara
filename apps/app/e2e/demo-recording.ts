// Records the footage for the demo video (apps/video): one continuous take of the whole product, plus a
// marker file saying when each chapter starts. Needs the same local stack as investor-flow.ts:
//   bun run indexer
//   SUMSUB_TOKEN= SUMSUB_SECRET= ADMIN_TOKEN=e2e bun run api
//   bun run --cwd apps/app build && bun run --cwd apps/app start
//   ADMIN_TOKEN=e2e bun apps/app/e2e/demo-recording.ts
import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { Keypair } from "@solana/web3.js";
import { chromium, type Page } from "playwright-core";

const APP = process.env.APP ?? "http://localhost:3000";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "";
const OUT = new URL("../../video/public/", import.meta.url).pathname;
const TAKE = `${OUT}take/`;
const SLOW = { timeout: 120_000 }; // devnet confirmations plus public-RPC rate limits
const SIZE = { width: 1600, height: 900 };

rmSync(TAKE, { recursive: true, force: true });
mkdirSync(TAKE, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", slowMo: 350 });
const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir: TAKE, size: SIZE } });
const started = Date.now();
const page = await context.newPage();

const markers: { id: string; at: number }[] = [];
const chapter = (id: string) => markers.push({ id, at: (Date.now() - started) / 1000 });
const pause = (ms: number) => page.waitForTimeout(ms);
const notice = (p: Page, text: string) => p.locator(".notice", { hasText: text }).waitFor(SLOW);
/** Scroll like a person reading, not a jump cut. */
async function scroll(by: number) {
  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel(0, by / 20);
    await page.waitForTimeout(25);
  }
}

try {
  await page.goto(APP);
  await page.locator(".table tbody tr").first().waitFor(SLOW);
  chapter("explore");
  await pause(2500);
  await scroll(520);
  await pause(3000);
  await scroll(-520);

  await page.getByRole("link", { name: "View the series" }).click();
  await page.locator(".area-chart polyline").waitFor(SLOW);
  chapter("asset");
  await pause(2500);
  await scroll(620);
  await pause(3500);
  await scroll(-620);

  chapter("fund");
  await page.locator(".trade").getByRole("button", { name: "Connect test wallet" }).click();
  const address = (await page.locator(".chip[title]").getAttribute("title")) ?? "";
  await page.getByRole("button", { name: "Get $1,000 test dollars" }).click();
  await notice(page, "Test dollars received");
  await page.getByRole("button", { name: "Awaiting operator approval" }).waitFor(SLOW);
  await pause(2000);

  chapter("approve");
  await page.getByRole("link", { name: "Operator" }).click();
  await page.locator('input[type="password"]').fill(ADMIN_TOKEN);
  await page.getByLabel("Investor address").fill(address);
  await page.getByLabel("Country code").fill("AE");
  await page.getByRole("button", { name: "Approve" }).click();
  await notice(page, "Investor approved");
  await pause(1500);

  await page.getByRole("link", { name: "Explore" }).click();
  await page.getByRole("link", { name: "View the series" }).click();
  await page.getByRole("button", { name: "Subscribe" }).waitFor(SLOW);
  chapter("subscribe");
  await page.getByRole("spinbutton").fill("10");
  await pause(1200);
  await page.getByRole("button", { name: "Subscribe" }).click();
  await notice(page, "Subscription settled");
  await pause(2500);

  await page.getByRole("link", { name: "Portfolio" }).click();
  await page.locator(".tile.sukuk").filter({ hasText: "10 units" }).waitFor(SLOW);
  chapter("portfolio");
  await pause(2500);
  await scroll(600);
  await pause(2500);
  await scroll(-600);

  await page.locator(".tile.sukuk").click();
  await page.getByRole("button", { name: "Send" }).first().click();
  chapter("refusal");
  await page.getByPlaceholder("Registered investor's address").fill(Keypair.generate().publicKey.toBase58());
  await pause(1000);
  await page.locator('form button[type="submit"]').click();
  await page.locator(".notice.error", { hasText: "no sukuk account" }).waitFor(SLOW);
  await pause(3500);

  await page.getByRole("link", { name: "Operator" }).click();
  chapter("distribution");
  // A period of its own, so this take always pays rather than finding the period already paid.
  await page.getByLabel("Period").fill(`D-${Date.now().toString(36)}`);
  await pause(1000);
  await page.getByRole("button", { name: "Pay all holders" }).click();
  await notice(page, "Distribution for");
  await pause(1500);
  await page.getByRole("link", { name: "Portfolio" }).click();
  await page.locator(".table", { hasText: "Distribution of" }).waitFor(SLOW);
  await page.locator(".table", { hasText: "Distribution of" }).scrollIntoViewIfNeeded();
  await pause(4000);
  chapter("end");
} finally {
  await context.close();
  await browser.close();
}

const file = readdirSync(TAKE).find((f) => f.endsWith(".webm"));
if (!file) throw new Error("no video was recorded");
renameSync(TAKE + file, `${OUT}demo.webm`);
rmSync(TAKE, { recursive: true, force: true });
writeFileSync(`${OUT}markers.json`, `${JSON.stringify(markers, null, 2)}\n`);
console.log(
  `Recorded ${markers.at(-1)?.at.toFixed(0)} s to apps/video/public/demo.webm with ${markers.length} markers.`,
);
