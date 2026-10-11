"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { investorCount, outstandingSeries, outstandingUnits } from "@/lib/activity";
import { type Asset, assetsFor, frequency, rate } from "@/lib/assets";
import { short, usd } from "@/lib/chain";
import { Activity } from "../activity-table";
import { useStore } from "../store";
import { TradePanel } from "../trade-panel";
import { AssetIcon, Sparkline, StatusPill } from "../ui";

export function AssetPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const { series, holders, events } = useStore();
  if (!series) return <p className="muted pad">Loading series…</p>;
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

  return (
    <div className="detail">
      <div>
        <p className="crumbs">
          <Link href="/">Explore</Link> / {asset.symbol}
        </p>
        <header className="asset-head">
          <AssetIcon symbol={asset.symbol} size={52} />
          <div>
            <h1>{asset.name}</h1>
            <p className="muted">
              {asset.symbol} · {t.currency} · <StatusPill live />
            </p>
          </div>
        </header>
        <p className="price">
          {usd(asset.unitValue, decimals)} <small>per unit, at par</small>
        </p>

        <section className="card">
          <h3>Units outstanding</h3>
          <Sparkline points={outstandingSeries(events)} width={720} height={180} />
          <p className="muted small">
            Built from subscriptions indexed from the chain. There is no secondary price feed.
          </p>
        </section>

        <section className="card">
          <h3>Key facts</h3>
          <dl className="facts">
            {stats.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="card">
          <h3>About</h3>
          <p>
            A mock dollar-denominated sovereign sukuk series used to demonstrate Tsamara. Each unit represents{" "}
            {usd(asset.unitValue, decimals)} of face value and pays an expected periodic distribution to registered
            investors.
          </p>
          <p className="muted small">This is not a real issuance and not an offer of securities.</p>
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
