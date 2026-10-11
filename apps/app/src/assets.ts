// The rows of the explore table: the live series from the API, plus previews that are not issued.
import type { Series } from "./chain";

export interface Asset {
  symbol: string;
  name: string;
  akad: string;
  maturity: string;
  profitRateBps: number;
  paymentsPerYear: number;
  /** Unit price in payment-token base units. */
  unitValue: bigint;
  /** Only a live asset exists onchain and can be subscribed to. */
  live: boolean;
}

// Shown to illustrate a multi-series catalogue. They are not issued, not onchain and cannot be bought.
const PREVIEWS: Asset[] = [
  {
    symbol: "GSD29",
    name: "Global Sukuk Demo 2029",
    akad: "Ijarah",
    maturity: "2029-06-15",
    profitRateBps: 480,
    paymentsPerYear: 2,
    unitValue: 10_000_000n,
    live: false,
  },
  {
    symbol: "GSD36",
    name: "Global Sukuk Demo 2036",
    akad: "Wakalah",
    maturity: "2036-03-20",
    profitRateBps: 565,
    paymentsPerYear: 2,
    unitValue: 10_000_000n,
    live: false,
  },
];

export function assetsFor(series: Series): Asset[] {
  const t = series.terms;
  return [
    {
      symbol: t.symbol,
      name: t.name,
      akad: t.akad,
      maturity: t.maturity,
      profitRateBps: t.profitRateBps,
      paymentsPerYear: t.paymentsPerYear,
      unitValue: BigInt(t.unitValue),
      live: true,
    },
    ...PREVIEWS,
  ];
}

export const rate = (bps: number) => `${(bps / 100).toFixed(2)}%`;
export const frequency = (perYear: number) =>
  perYear === 2 ? "Semiannual" : perYear === 4 ? "Quarterly" : perYear === 12 ? "Monthly" : `${perYear} per year`;
