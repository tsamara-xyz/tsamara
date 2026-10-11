"use client";

import Link from "next/link";
import { useState } from "react";
import { investorCount, outstandingSeries, outstandingUnits } from "@/lib/activity";
import { assetsFor, rate } from "@/lib/assets";
import { explorer, short, usd } from "@/lib/chain";
import { describe } from "../activity-table";
import { SeriesTable } from "../series-table";
import { useStore } from "../store";
import { AssetIcon, Sparkline } from "../ui";

export function ExplorePage() {
  const { series, holders, events, wallet, position, search: query } = useStore();
  const [tab, setTab] = useState<"all" | "live" | "preview">("all");
  if (!series) return <p className="muted pad">Loading series…</p>;

  const decimals = series.paymentDecimals;
  const chart = outstandingSeries(events);
  const outstanding = outstandingUnits(holders);
  const assets = assetsFor(series);
  const shown = assets.filter(
    (a) =>
      (tab === "all" || (tab === "live") === a.live) &&
      `${a.symbol} ${a.name} ${a.akad}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const value = (position?.units ?? 0n) * BigInt(series.terms.unitValue);
  const live = assets[0];

  return (
    <>
      <section className="card strip">
        <div>
          <p className="label">Total Portfolio Value</p>
          <p className="big">{wallet ? usd(value, decimals) : "$0.00"}</p>
        </div>
        <dl className="mini">
          <div>
            <dt>Units</dt>
            <dd>{String(position?.units ?? 0n)}</dd>
          </div>
          <div>
            <dt>Test dollars</dt>
            <dd>{usd(position?.dollars ?? 0n, decimals)}</dd>
          </div>
          <div>
            <dt>KYC</dt>
            <dd>{position?.registered ? "Approved" : "Not approved"}</dd>
          </div>
        </dl>
        <Sparkline points={chart} width={220} height={44} />
        <Link className="more" href="/portfolio">
          View Portfolio →
        </Link>
      </section>

      <section className="hero">
        <div>
          <h1>Sovereign Sukuk in $10 Units</h1>
          <p>Dollar sukuk in $10 units, with every transfer rule enforced onchain.</p>
          {live && (
            <Link className="btn light" href={`/assets/${live.symbol.toLowerCase()}`}>
              Invest now
            </Link>
          )}
        </div>
        <ul aria-hidden="true">
          <li>Wakalah</li>
          <li>Ijarah</li>
          <li>Sovereign</li>
          <li>• Sukuk</li>
          <li>Asset-based</li>
          <li>Onchain</li>
        </ul>
      </section>

      <section className="trio">
        <div className="card">
          <h3>
            Open now <span className="tag">devnet</span>
          </h3>
          {assets
            .filter((a) => a.live)
            .map((a) => (
              <Link className="feature" key={a.symbol} href={`/assets/${a.symbol.toLowerCase()}`}>
                <AssetIcon symbol={a.symbol} />
                <span>
                  <strong>{a.symbol}</strong>
                  <small>{a.name}</small>
                </span>
                <span className="num">
                  <strong>{usd(a.unitValue, decimals)}</strong>
                  <small className="up">{rate(a.profitRateBps)} p.a.</small>
                </span>
              </Link>
            ))}
          <p className="muted small">
            {String(outstanding)} units outstanding across {investorCount(holders)} investors.
          </p>
        </div>
        <div className="card">
          <h3>Latest activity</h3>
          {events.length === 0 && <p className="muted small">No activity indexed yet.</p>}
          {events.slice(0, 3).map((e) => (
            <a
              className="feature"
              key={e.signature + e.kind + e.wallet}
              href={explorer(e.signature)}
              target="_blank"
              rel="noreferrer"
            >
              <AssetIcon symbol={series.terms.symbol} />
              <span>
                <strong>{describe(e, decimals)}</strong>
                <small>{short(e.wallet)}</small>
              </span>
            </a>
          ))}
        </div>
        <div className="card">
          <h3>Enforced onchain</h3>
          <ul className="rules">
            <li>Accounts stay frozen until an investor passes KYC</li>
            <li>Every transfer checks the recipient and the holding cap</li>
            <li>Payment and delivery settle in one transaction</li>
          </ul>
        </div>
      </section>

      <section className="card list">
        <div className="tabs">
          {(["all", "live", "preview"] as const).map((t) => (
            <button type="button" key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
              {t === "all" ? "Sukuk series" : t === "live" ? "Open" : "Preview"}{" "}
              <span className="tag">{assets.filter((a) => t === "all" || (t === "live") === a.live).length}</span>
            </button>
          ))}
        </div>
        <SeriesTable assets={shown} decimals={decimals} outstanding={outstanding} chart={chart} query={query} />
        <p className="muted small pad">
          Preview series illustrate the catalogue. They are not issued and cannot be bought.
        </p>
      </section>
    </>
  );
}
