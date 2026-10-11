import { expect, test } from "bun:test";
import { isEligible, periodicDistribution, termsToFields, type SeriesTerms } from "./series";

// $10 units, 5.20% p.a., semiannual, paid in a 6-decimal dollar token.
const terms: SeriesTerms = {
  name: "Global Sukuk Demo 2031",
  symbol: "GSD31",
  akad: "Wakalah",
  maturity: "2031-10-10",
  currency: "USD",
  profitRateBps: 520,
  paymentsPerYear: 2,
  unitValue: 10_000_000n,
  restrictedJurisdictions: ["US"],
};

test("periodic distribution is pro rata", () => {
  expect(periodicDistribution(60n, terms)).toBe(15_600_000n); // $15.60
  expect(periodicDistribution(40n, terms)).toBe(10_400_000n); // $10.40
  expect(periodicDistribution(0n, terms)).toBe(0n);
});

test("periodic distribution rounds down to the base unit", () => {
  expect(periodicDistribution(1n, { ...terms, unitValue: 100n, profitRateBps: 525 })).toBe(2n); // 2.625
});

test("terms are serialised as onchain metadata fields", () => {
  expect(Object.fromEntries(termsToFields(terms))).toEqual({
    akad: "Wakalah",
    maturity: "2031-10-10",
    currency: "USD",
    profit_rate_bps: "520",
    payments_per_year: "2",
    unit_value: "10000000",
    restricted_jurisdictions: "US",
  });
});

test("residents of restricted jurisdictions are not eligible", () => {
  expect(isEligible("AE", terms)).toBe(true);
  expect(isEligible("US", terms)).toBe(false);
  expect(isEligible("us", terms)).toBe(false);
});
