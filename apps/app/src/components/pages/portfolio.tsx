"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { holdingHistory, inRange, outstandingSeries, type Range } from "@/lib/activity";
import { assetsFor, rate } from "@/lib/assets";
import { short, usd } from "@/lib/chain";
import { Activity } from "../activity-table";
import { AssetCard } from "../asset-card";
import { AreaChart } from "../chart";
import { useStore } from "../store";
import { AssetIcon, ConnectButtons, EmptyState, RangeTabs, SeriesPending } from "../ui";

type AssetClass = "all" | "cash" | "sukuk";

const sum = (values: bigint[]) => values.reduce((a, b) => a + b, 0n);

/** "$1,250.00" split so the cents can be dimmed, as in the header figure. */
function Figure({ amount }: { amount: string }) {
  const [whole, cents] = amount.split(".");
  return (
    <p className="figure">
      {whole}
      <span>.{cents}</span>
    </p>
  );
}

export function PortfolioPage() {
  const { series, wallet, position, events } = useStore();
  const [range, setRange] = useState<Range>("1W");
  const [assetClass, setAssetClass] = useState<AssetClass>("all");
  const [search, setSearch] = useState("");
  // The clock is read after mount so the server-rendered page and the browser agree.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Math.floor(Date.now() / 1000)), []);

  if (!series) return <SeriesPending />;
  if (!wallet) {
    return (
      <section className="card center">
        <h2>Your portfolio</h2>
        <p className="muted">Connect a wallet to see your holdings, distributions and history.</p>
        <ConnectButtons />
      </section>
    );
  }

  const address = wallet.publicKey.toBase58();
  const decimals = series.paymentDecimals;
  const t = series.terms;
  const price = BigInt(t.unitValue);
  const units = position?.units ?? 0n;
  const dollars = position?.dollars ?? 0n;
  const sukukValue = units * price;
  const total = sukukValue + dollars;
  const mine = events.filter((e) => e.wallet === address || e.counterparty === address);
  const received = sum(
    mine.filter((e) => e.kind === "distribution" && e.wallet === address).map((e) => BigInt(e.amount)),
  );
  const points = now
    ? inRange(holdingHistory(events, address), range, now).map((p) => ({
        time: p.time,
        value: p.units * Number(price),
      }))
    : [];

  const matches = (name: string) => name.toLowerCase().includes(search.trim().toLowerCase());
  const showCash = assetClass !== "sukuk" && matches("test dollars usd cash");
  const showSukuk = assetClass !== "cash" && units > 0n && matches(`${t.symbol} ${t.name} sukuk`);
  const share = (part: bigint) => (total > 0n ? Number((part * 10_000n) / total) / 100 : 0);

  return (
    <>
      <header className="welcome">
        <span className="avatar" aria-hidden="true" />
        <h1>
          <span className="muted">Welcome,</span> {short(address)}
        </h1>
        <time className="muted">{now ? new Date(now * 1000).toLocaleString() : ""}</time>
      </header>

      <section className="card">
        <div className="value-head">
          <Figure amount={usd(total, decimals)} />
          <RangeTabs value={range} onChange={setRange} />
        </div>
        <div className="chart-scroll">
          <AreaChart
            points={points}
            format={(v) => usd(BigInt(Math.round(v)), decimals)}
            label="Value of sukuk held over time"
          />
        </div>
        <p className="muted small">
          The chart tracks sukuk holdings at par, from indexed transactions; the figure above also counts test dollars.
          Distributions received so far: {usd(received, decimals)}.
        </p>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>My Holdings</h3>
          <label className="select">
            <span className="sr-only">Asset class</span>
            <select value={assetClass} onChange={(e) => setAssetClass(e.target.value as AssetClass)}>
              <option value="all">Asset Class</option>
              <option value="sukuk">Sukuk</option>
              <option value="cash">Cash</option>
            </select>
          </label>
          <span className="chip">Solana devnet</span>
          <input
            className="search"
            type="search"
            placeholder="Search asset"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search asset"
          />
        </div>
        <div className="tiles">
          {showCash && (
            <div className="tile cash">
              <span className="tile-icon">$</span>
              <span>
                <small>Test dollars</small>
                <strong>{usd(dollars, decimals)}</strong>
              </span>
            </div>
          )}
          {showSukuk && (
            <Link className="tile sukuk" href={`/assets/${t.symbol.toLowerCase()}`}>
              <AssetIcon symbol={t.symbol} size={32} />
              <span>
                <small>
                  {t.symbol} · {String(units)} units · {rate(t.expectedProfitRateBps)} expected
                </small>
                <strong>{usd(sukukValue, decimals)}</strong>
              </span>
            </Link>
          )}
        </div>
        {units === 0n && (
          <EmptyState icon="◎">
            No holdings found. <Link href={`/assets/${t.symbol.toLowerCase()}`}>Subscribe to {t.symbol}</Link> to see
            your assets in one place.
          </EmptyState>
        )}
      </section>

      <section className="card">
        <h3>Portfolio Allocation</h3>
        {total > 0n ? (
          <>
            <div className="allocation" role="img" aria-label={`Sukuk ${share(sukukValue)}%, cash ${share(dollars)}%`}>
              <span className="sukuk" style={{ width: `${share(sukukValue)}%` }} />
              <span className="cash" style={{ width: `${share(dollars)}%` }} />
            </div>
            <dl className="legend">
              <div>
                <dt>
                  <i className="sukuk" /> Sukuk
                </dt>
                <dd>
                  {usd(sukukValue, decimals)} · {share(sukukValue)}%
                </dd>
              </div>
              <div>
                <dt>
                  <i className="cash" /> Cash
                </dt>
                <dd>
                  {usd(dollars, decimals)} · {share(dollars)}%
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <EmptyState icon="▥">Portfolio insights will be available once your wallet has holdings.</EmptyState>
        )}
      </section>

      <section className="card">
        <h3>Recent Transactions</h3>
        {mine.length > 0 ? (
          <Activity events={mine} decimals={decimals} empty="" />
        ) : (
          <EmptyState icon="⇄">No transactions yet. Your activity will show up as you use your wallet.</EmptyState>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h3>Other series</h3>
            <p className="muted small">Series in the catalogue. Preview series are not issued and cannot be bought.</p>
          </div>
          <Link className="btn soft" href="/">
            Explore all series
          </Link>
        </div>
        <div className="asset-grid">
          {assetsFor(series).map((asset) => (
            <AssetCard key={asset.symbol} asset={asset} decimals={decimals} chart={outstandingSeries(events)} />
          ))}
        </div>
      </section>
    </>
  );
}
