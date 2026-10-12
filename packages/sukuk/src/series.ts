/** Terms of a sukuk series. Stored onchain as Token-2022 metadata so any wallet or indexer can read them. */
export interface SeriesTerms {
  name: string;
  symbol: string;
  /** Underlying sharia contract, e.g. "Wakalah". */
  akad: string;
  /** ISO date. */
  maturity: string;
  /** Denomination, e.g. "USD". */
  currency: string;
  /** Expected annual profit rate in basis points. It is an expectation set by the structure, not a guarantee. */
  expectedProfitRateBps: number;
  /** Periodic distributions per year (2 = semiannual). */
  paymentsPerYear: number;
  /** Face value of one token, in base units of the payment token (USDC has 6 decimals). */
  unitValue: bigint;
  /** ISO 3166-1 alpha-2 codes of jurisdictions whose residents may not hold this series, e.g. ["US"]. */
  restrictedJurisdictions: string[];
  /** Maximum units one investor may hold, enforced onchain on every transfer. */
  maxHolding: bigint;
  /** Share of the underlying that is tangible assets, in basis points, as last reported. */
  tangibleAssetsBps: number;
  /** ISO date the tangibility ratio was reported. */
  tangibilityAsOf: string;
}

/** Below this share of tangible assets a sukuk may only change hands at par (AAOIFI Standard 59, DSN-MUI Fatwa 95/2014). */
export const MIN_TANGIBLE_BPS = 5_100;

/** Whether units may be transferred at a price the parties agree, rather than only at par. */
export const isTradableAtAgreedPrice = (t: SeriesTerms): boolean => t.tangibleAssetsBps >= MIN_TANGIBLE_BPS;

export const termsToFields = (t: SeriesTerms): [string, string][] => [
  ["akad", t.akad],
  ["maturity", t.maturity],
  ["currency", t.currency],
  ["expected_profit_rate_bps", String(t.expectedProfitRateBps)],
  ["payments_per_year", String(t.paymentsPerYear)],
  ["unit_value", String(t.unitValue)],
  ["restricted_jurisdictions", t.restrictedJurisdictions.join(",")],
  ["max_holding", String(t.maxHolding)],
  ["tangible_assets_bps", String(t.tangibleAssetsBps)],
  ["tangibility_as_of", t.tangibilityAsOf],
];

export const isEligible = (jurisdiction: string, t: SeriesTerms): boolean =>
  !t.restrictedJurisdictions.some((r) => r.toUpperCase() === jurisdiction.toUpperCase());

/** Payment-token base units owed for one period on `units` tokens, rounded down. */
export const periodicDistribution = (units: bigint, t: SeriesTerms): bigint =>
  (units * t.unitValue * BigInt(t.expectedProfitRateBps)) / (10_000n * BigInt(t.paymentsPerYear));
