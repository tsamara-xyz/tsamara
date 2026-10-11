/** Terms of a sukuk series. Stored onchain as Token-2022 metadata so any wallet or indexer can read them. */
export interface SeriesTerms {
  name: string;
  symbol: string;
  /** Underlying sharia contract, e.g. "Ijarah Asset to be Leased". */
  akad: string;
  /** ISO date. */
  maturity: string;
  /** Fixed annual imbalan in basis points. */
  imbalanBps: number;
  /** Rupiah nominal represented by one token. */
  unitRupiah: number;
}

export const termsToFields = (t: SeriesTerms): [string, string][] => [
  ["akad", t.akad],
  ["maturity", t.maturity],
  ["imbalan_bps", String(t.imbalanBps)],
  ["unit_idr", String(t.unitRupiah)],
];
