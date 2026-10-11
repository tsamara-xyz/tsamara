// Checks that the Sumsub verification widget opens inside the app. Needs the API running with
// sandbox Sumsub credentials, the indexer and the app:
//   bun apps/app/e2e/kyc-dialog.ts
import { chromium } from "playwright-core";

const APP = process.env.APP ?? "http://localhost:3000";
const SLOW = { timeout: 90_000 };

const browser = await chromium.launch({ channel: "chrome", headless: process.env.HEADED !== "1" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
try {
  await page.goto(`${APP}/assets/gsd31`);
  await page.getByRole("button", { name: "Use a test wallet" }).click();
  await page.getByRole("button", { name: "Get $1,000 test dollars" }).click();
  await page.getByRole("button", { name: "Verify identity to continue" }).click(SLOW);
  await page.getByRole("dialog", { name: "Verify your identity" }).waitFor();
  // The widget is an iframe served by Sumsub; its first screen appearing means the access token was accepted.
  const widget = page.frameLocator("#sumsub-websdk-container iframe");
  await widget.locator("body").waitFor(SLOW);
  await page.locator(".kyc-loader").waitFor({ state: "detached", ...SLOW });
  // An empty frame also has a body, so wait for the first screen to offer something to press.
  await widget.getByRole("button").first().waitFor(SLOW);
  await page.screenshot({ path: "e2e-kyc-dialog.png" });
  console.log("Sumsub widget loaded inside the dialog; screenshot saved to e2e-kyc-dialog.png");
} finally {
  await browser.close();
}
