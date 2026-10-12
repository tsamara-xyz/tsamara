"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { inRange, investorCount, outstandingHistory, outstandingUnits, type Range } from "@/lib/activity";
import { type Asset, assetsFor, frequency, rate } from "@/lib/assets";
import { short, usd } from "@/lib/chain";
import { Activity } from "../activity-table";
import { AreaChart } from "../chart";
import { useStore } from "../store";
import { TradePanel } from "../trade-panel";
import { AssetIcon, RangeTabs, SeriesPending, StatusPill } from "../ui";

export function AssetPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const { series, holders, events } = useStore();
  const [range, setRange] = useState<Range>("ALL");
  // The clock is read after mount so the server-rendered page and the browser agree.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Math.floor(Date.now() / 1000)), []);
  if (!series) return <SeriesPending />;
  const asset: Asset | undefined = assetsFor(series).find(
    (a) => a.symbol.toLowerCase() === symbol?.toLowerCase() && a.live,
  );
  if (!asset) {
    return (
      <p className="muted pad">
        This series is not open. <Link href="/">Back to all series</Link>
      </p>
    );
  }
  const t = series.terms;
  const decimals = series.paymentDecimals;
  const outstanding = outstandingUnits(holders);
  const stats: [string, string][] = [
    ["Expected profit rate", `${rate(asset.profitRateBps)} p.a.`],
    ["Distributions", frequency(asset.paymentsPerYear)],
    ["Maturity", asset.maturity],
    ["Structure", asset.akad],
    ["Outstanding", usd(outstanding * asset.unitValue, decimals)],
    ["Investors", String(investorCount(holders))],
    ["Holding cap", `${t.maxHolding} units`],
    ["Not offered in", t.restrictedJurisdictions.join(", ") || "none"],
    ["Tangible assets", `${rate(t.tangibleAssetsBps)} as of ${t.tangibilityAsOf}`],
    ["Transfers", t.tangibleAssetsBps >= 5_100 ? "At agreed prices" : "At par only"],
  ];
  const address = (label: string, value: string) => (
    <div>
      <dt>{label}</dt>
      <dd>
        <a href={`https://explorer.solana.com/address/${value}?cluster=devnet`} target="_blank" rel="noreferrer">
          {short(value)} ↗
        </a>
      </dd>
    </div>
  );

  const points = now
    ? inRange(outstandingHistory(events), range, now).map((p) => ({
        time: p.time,
        value: p.units * Number(asset.unitValue),
      }))
    : [];

  return (
    <div className="detail">
      <div>
        <header className="asset-head">
          <AssetIcon symbol={asset.symbol} size={40} />
          <h1>
            {asset.name} <span>{asset.symbol}</span>
          </h1>
          <StatusPill live />
        </header>

        <section className="card chart-card">
          <p className="figure">{usd(asset.unitValue, decimals)}</p>
          <p className="chart-sub">Per unit, at par · {rate(asset.profitRateBps)} expected profit rate p.a.</p>
          <RangeTabs value={range} onChange={setRange} />
          <div className="chart-scroll">
            <AreaChart
              points={points}
              format={(v) => usd(BigInt(Math.round(v)), decimals)}
              label="Value of units outstanding over time"
            />
          </div>
          <p className="muted small">
            The chart is the value of units outstanding, built from subscriptions indexed from the chain. Units are
            priced at par; there is no secondary price feed.
          </p>
        </section>

        <section className="card">
          <h3>About</h3>
          <p>
            A mock dollar-denominated sovereign sukuk series used to demonstrate Tsamara. Each unit represents{" "}
            {usd(asset.unitValue, decimals)} of face value and pays an expected periodic distribution to registered
            investors.
          </p>
          <dl className="facts">
            {stats.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="muted small">
            The compliance authority can freeze an account, and can move units without the holder's signature to recover
            lost keys, for inheritance, or on an order from a court or regulator. Each such transfer is recorded onchain
            with its reason. This is not a real issuance and not an offer of securities.
          </p>
        </section>

        <section className="card">
          <h3>Onchain</h3>
          <dl className="facts">
            {address("Sukuk token", series.sukukMint)}
            {address("Compliance program", series.complianceProgram)}
            {address("Issuer", series.issuer)}
            {address("Payment token", series.paymentMint)}
          </dl>
          <p className="muted small">The terms above are also published in the token's onchain metadata.</p>
        </section>

        <section className="card">
          <h3>Activity</h3>
          <Activity events={events.slice(0, 12)} decimals={decimals} empty="No activity indexed yet." />
        </section>
      </div>
      <TradePanel />
    </div>
  );
}
