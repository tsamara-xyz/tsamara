import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { type Asset, assetsFor, frequency, rate } from "./assets";
import { api, type ChainEvent, explorer, short, usd } from "./chain";
import { AssetIcon, ConnectButtons, Sparkline, StatusPill, TradePanel } from "./components";
import { outstandingSeries, useStore } from "./store";

const sum = (values: bigint[]) => values.reduce((a, b) => a + b, 0n);

function describe(e: ChainEvent, decimals: number): string {
  if (e.kind === "approved") return "Investor approved";
  if (e.kind === "revoked") return "Investor revoked";
  if (e.kind === "subscription") return `Subscribed ${e.units} units for ${usd(e.amount, decimals)}`;
  if (e.kind === "distribution") return `Distribution of ${usd(e.amount, decimals)}`;
  return `Transferred ${e.units} units`;
}

function Activity({ events, decimals, empty }: { events: ChainEvent[]; decimals: number; empty: string }) {
  if (events.length === 0) return <p className="muted small">{empty}</p>;
  return (
    <table className="table compact">
      <thead>
        <tr>
          <th>Event</th>
          <th>Investor</th>
          <th className="num">Time</th>
        </tr>
      </thead>
      <tbody>
        {events.map((e) => (
          <tr key={e.signature + e.kind + e.wallet}>
            <td>{describe(e, decimals)}</td>
            <td title={e.wallet}>{short(e.wallet)}</td>
            <td className="num">
              <a href={explorer(e.signature)} target="_blank" rel="noreferrer">
                {e.time ? new Date(e.time * 1000).toLocaleString() : "pending"} ↗
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ExplorePage({ query }: { query: string }) {
  const { series, holders, events, wallet, position } = useStore();
  const [tab, setTab] = useState<"all" | "live" | "preview">("all");
  const navigate = useNavigate();
  if (!series) return <p className="muted pad">Loading series…</p>;

  const decimals = series.paymentDecimals;
  const chart = outstandingSeries(events);
  const outstanding = sum(holders.map((h) => BigInt(h.units)));
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
        <Link className="more" to="/portfolio">
          View Portfolio →
        </Link>
      </section>

      <section className="hero">
        <div>
          <h1>Sovereign Sukuk, Open Access</h1>
          <p>Dollar sukuk in $10 units, with every transfer rule enforced onchain.</p>
          {live && (
            <Link className="btn light" to={`/assets/${live.symbol.toLowerCase()}`}>
              Invest now
            </Link>
          )}
        </div>
        <ul aria-hidden="true">
          <li>Wakalah</li>
          <li>Ijarah</li>
          <li>Sovereign</li>
          <li>• Sukuk</li>
          <li>Halal yield</li>
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
              <Link className="feature" key={a.symbol} to={`/assets/${a.symbol.toLowerCase()}`}>
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
            {String(outstanding)} units outstanding across {holders.filter((h) => h.units !== "0").length} investors.
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
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Asset Name</th>
              <th className="num">Price</th>
              <th className="num">Profit rate</th>
              <th>Maturity</th>
              <th className="num">Outstanding</th>
              <th>Asset Status</th>
              <th className="num">Units issued</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((a, i) => (
              <tr
                key={a.symbol}
                className={a.live ? "clickable" : "dim"}
                onClick={() => a.live && navigate(`/assets/${a.symbol.toLowerCase()}`)}
              >
                <td>{i + 1}</td>
                <td>
                  <span className="name">
                    <AssetIcon symbol={a.symbol} />
                    <span>
                      <strong>{a.symbol}</strong>
                      <small>{a.name}</small>
                    </span>
                  </span>
                </td>
                <td className="num">{usd(a.unitValue, decimals)}</td>
                <td className="num up">{rate(a.profitRateBps)}</td>
                <td>{a.maturity}</td>
                <td className="num">{a.live ? usd(outstanding * a.unitValue, decimals) : "—"}</td>
                <td>
                  <StatusPill live={a.live} />
                </td>
                <td className="num">
                  <Sparkline points={a.live ? chart : []} muted={!a.live} />
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={8} className="muted">
                  No series match “{query}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="muted small pad">
          Preview series illustrate the catalogue. They are not issued and cannot be bought.
        </p>
      </section>
    </>
  );
}

export function AssetPage() {
  const { symbol } = useParams();
  const { series, holders, events } = useStore();
  if (!series) return <p className="muted pad">Loading series…</p>;
  const asset: Asset | undefined = assetsFor(series).find(
    (a) => a.symbol.toLowerCase() === symbol?.toLowerCase() && a.live,
  );
  if (!asset) {
    return (
      <p className="muted pad">
        This series is not open. <Link to="/">Back to all series</Link>
      </p>
    );
  }
  const t = series.terms;
  const decimals = series.paymentDecimals;
  const outstanding = sum(holders.map((h) => BigInt(h.units)));
  const stats: [string, string][] = [
    ["Profit rate", `${rate(asset.profitRateBps)} p.a.`],
    ["Distributions", frequency(asset.paymentsPerYear)],
    ["Maturity", asset.maturity],
    ["Structure", asset.akad],
    ["Outstanding", usd(outstanding * asset.unitValue, decimals)],
    ["Investors", String(holders.filter((h) => h.units !== "0").length)],
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
          <Link to="/">Explore</Link> / {asset.symbol}
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
            {usd(asset.unitValue, decimals)} of face value and pays a fixed periodic distribution to registered
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

export function PortfolioPage() {
  const { series, wallet, position, events } = useStore();
  if (!series) return <p className="muted pad">Loading series…</p>;
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
  const mine = events.filter((e) => e.wallet === address || e.counterparty === address);
  const received = sum(
    mine.filter((e) => e.kind === "distribution" && e.wallet === address).map((e) => BigInt(e.amount)),
  );
  const units = position?.units ?? 0n;
  const value = units * BigInt(series.terms.unitValue);

  return (
    <>
      <section className="card strip">
        <div>
          <p className="label">Total Portfolio Value</p>
          <p className="big">{usd(value, decimals)}</p>
        </div>
        <dl className="mini">
          <div>
            <dt>Distributions received</dt>
            <dd>{usd(received, decimals)}</dd>
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
        <code className="muted small">{address}</code>
      </section>

      <section className="card list">
        <h3 className="pad">Holdings</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Asset Name</th>
              <th className="num">Units</th>
              <th className="num">Price</th>
              <th className="num">Value</th>
              <th className="num">Profit rate</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {units > 0n ? (
              <tr>
                <td>
                  <span className="name">
                    <AssetIcon symbol={series.terms.symbol} />
                    <span>
                      <strong>{series.terms.symbol}</strong>
                      <small>{series.terms.name}</small>
                    </span>
                  </span>
                </td>
                <td className="num">{String(units)}</td>
                <td className="num">{usd(series.terms.unitValue, decimals)}</td>
                <td className="num">{usd(value, decimals)}</td>
                <td className="num up">{rate(series.terms.profitRateBps)}</td>
                <td className="num">
                  <Link className="btn small" to={`/assets/${series.terms.symbol.toLowerCase()}`}>
                    Trade
                  </Link>
                </td>
              </tr>
            ) : (
              <tr>
                <td colSpan={6} className="muted">
                  No holdings yet.{" "}
                  <Link to={`/assets/${series.terms.symbol.toLowerCase()}`}>Subscribe to {series.terms.symbol}</Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h3>History</h3>
        <Activity events={mine} decimals={decimals} empty="Nothing yet." />
      </section>
    </>
  );
}

export function OperatorPage() {
  const { series, holders, busy, run } = useStore();
  const [token, setToken] = useState(() => sessionStorage.getItem("tsamara-admin") ?? "");
  const saveToken = (value: string) => {
    setToken(value);
    sessionStorage.setItem("tsamara-admin", value);
  };
  const field = (form: HTMLFormElement, name: string) => String(new FormData(form).get(name) ?? "").trim();

  return (
    <>
      <section className="card">
        <h2>Operator</h2>
        <p className="muted">
          Compliance and issuer actions are signed by the operator API and require its admin token.
        </p>
        <label className="field">
          <span>Admin token</span>
          <input type="password" value={token} onChange={(e) => saveToken(e.target.value)} />
        </label>
      </section>

      <div className="two">
        <section className="card">
          <h3>{series?.kyc === "sumsub" ? "Sandbox: complete a Sumsub review" : "Approve an investor"}</h3>
          {series?.kyc === "sumsub" ? (
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                const wallet = field(e.currentTarget, "wallet");
                run(
                  "Review marked approved; the investor can now finish verification",
                  async () => void (await api.sandboxReview(token, wallet)),
                );
              }}
            >
              <input name="wallet" placeholder="Investor address" required aria-label="Investor address" />
              <button type="submit" className="btn primary" disabled={busy}>
                Mark approved
              </button>
              <p className="muted small">
                Stands in for Sumsub's reviewer in the sandbox. The onchain approval still happens only after the API
                reads the verdict.
              </p>
            </form>
          ) : (
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                run(
                  "Investor approved",
                  async () => (await api.kyc(token, field(form, "wallet"), field(form, "jurisdiction"))).signature,
                );
              }}
            >
              <input name="wallet" placeholder="Investor address" required aria-label="Investor address" />
              <input
                name="jurisdiction"
                placeholder="Country (e.g. AE)"
                maxLength={2}
                required
                aria-label="Country code"
                className="narrow"
              />
              <button type="submit" className="btn primary" disabled={busy}>
                Approve
              </button>
            </form>
          )}
        </section>

        <section className="card">
          <h3>Pay the periodic distribution</h3>
          <p className="muted small">Pays every holder pro rata from the issuer treasury in one transaction.</p>
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={() => run("Distribution paid", async () => (await api.distribute(token)).signature)}
          >
            Pay all holders
          </button>
        </section>
      </div>

      <section className="card list">
        <h3 className="pad">Holders</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Investor</th>
              <th className="num">Units</th>
              <th>KYC</th>
            </tr>
          </thead>
          <tbody>
            {holders.map((h) => (
              <tr key={h.wallet}>
                <td>
                  <code>{h.wallet}</code>
                </td>
                <td className="num">{h.units}</td>
                <td>{h.approved ? "Approved" : "Frozen"}</td>
              </tr>
            ))}
            {holders.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  No holders yet, or the indexer is not running.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
