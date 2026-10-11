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
  /** Fixed annual profit rate in basis points. */
  profitRateBps: number;
  /** Periodic distributions per year (2 = semiannual). */
  paymentsPerYear: number;
  /** Face value of one token, in base units of the payment token (USDC has 6 decimals). */
  unitValue: bigint;
  /** ISO 3166-1 alpha-2 codes of jurisdictions whose residents may not hold this series, e.g. ["US"]. */
  restrictedJurisdictions: string[];
  /** Maximum units one investor may hold, enforced onchain on every transfer. */
  maxHolding: bigint;
}

export const termsToFields = (t: SeriesTerms): [string, string][] => [
  ["akad", t.akad],
  ["maturity", t.maturity],
  ["currency", t.currency],
  ["profit_rate_bps", String(t.profitRateBps)],
  ["payments_per_year", String(t.paymentsPerYear)],
  ["unit_value", String(t.unitValue)],
  ["restricted_jurisdictions", t.restrictedJurisdictions.join(",")],
  ["max_holding", String(t.maxHolding)],
];

export const isEligible = (jurisdiction: string, t: SeriesTerms): boolean =>
  !t.restrictedJurisdictions.includes(jurisdiction.toUpperCase());

/** Payment-token base units owed for one period on `units` tokens, rounded down. */
export const periodicDistribution = (units: bigint, t: SeriesTerms): bigint =>
  (units * t.unitValue * BigInt(t.profitRateBps)) / (10_000n * BigInt(t.paymentsPerYear));
