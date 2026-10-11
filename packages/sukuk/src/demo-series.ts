import type { SeriesTerms } from "./series";

/** The mock series used by the devnet demo, the API and the app. Not a real issuance. */
export const DEMO_SERIES: SeriesTerms = {
  name: "Global Sukuk Demo 2031",
  symbol: "GSD31",
  akad: "Wakalah",
  maturity: "2031-10-10",
  currency: "USD",
  profitRateBps: 520,
  paymentsPerYear: 2,
  unitValue: 10_000_000n, // $10 in a 6-decimal token
  restrictedJurisdictions: ["US"],
  maxHolding: 100n,
};
