import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";
import {
  api,
  burnerWallet,
  type ChainEvent,
  connectPhantom,
  dollarBalance,
  explain,
  explorer,
  type Holder,
  type Series,
  short,
  subscribe,
  transfer,
  usd,
  type Wallet,
} from "./chain";

type Notice = { tone: "ok" | "error"; text: string; signature?: string } | null;

export function App() {
  const [series, setSeries] = useState<Series | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [view, setView] = useState<"investor" | "operator">("investor");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.series().then(setSeries, (e) => setNotice({ tone: "error", text: explain(e) }));
  }, []);

  // Every action goes through here: one in-flight request, one place for errors and explorer links.
  const run = useCallback(async (label: string, action: () => Promise<string | undefined>) => {
    setBusy(true);
    setNotice(null);
    try {
      setNotice({ tone: "ok", text: label, signature: await action() });
    } catch (e) {
      setNotice({ tone: "error", text: explain(e) });
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div className="shell">
      <header className="top">
        <a className="brand" href="https://tsamara.xyz">
          <img src="/android-chrome-192x192.png" width="32" height="32" alt="" />
          <span>Tsamara</span>
        </a>
        <nav className="tabs">
          <button type="button" className={view === "investor" ? "on" : ""} onClick={() => setView("investor")}>
            Investor
          </button>
          <button type="button" className={view === "operator" ? "on" : ""} onClick={() => setView("operator")}>
            Operator
          </button>
        </nav>
        {wallet ? (
          <span className="pill" title={wallet.publicKey.toBase58()}>
            {wallet.kind === "burner" ? "Test wallet" : "Phantom"} · {short(wallet.publicKey.toBase58())}
          </span>
        ) : (
          <span className="pill muted">Devnet</span>
        )}
      </header>

      <p className="banner">Devnet prototype with a mock series. Not an offer of securities.</p>

      {notice && (
        <p className={`notice ${notice.tone}`} role="status">
          {notice.text}{" "}
          {notice.signature && (
            <a href={explorer(notice.signature)} target="_blank" rel="noreferrer">
              View transaction ↗
            </a>
          )}
        </p>
      )}

      {series ? (
        <main className="grid">
          <SeriesCard series={series} />
          {view === "investor" ? (
            <InvestorPanel series={series} wallet={wallet} setWallet={setWallet} busy={busy} run={run} />
          ) : (
            <OperatorPanel busy={busy} run={run} />
          )}
        </main>
      ) : (
        <p className="muted">Loading series…</p>
      )}
    </div>
  );
}

function SeriesCard({ series }: { series: Series }) {
  const t = series.terms;
  const facts: [string, ReactNode][] = [
    ["Structure", t.akad],
    ["Profit rate", `${(t.profitRateBps / 100).toFixed(2)}% p.a.`],
    ["Distributions", t.paymentsPerYear === 2 ? "Semiannual" : `${t.paymentsPerYear} per year`],
    ["Maturity", t.maturity],
    ["Unit size", usd(t.unitValue, series.paymentDecimals)],
    ["Holding cap", `${t.maxHolding} units per investor`],
    ["Not offered in", t.restrictedJurisdictions.join(", ") || "none"],
  ];
  return (
    <section className="card series">
      <p className="kicker">{t.symbol}</p>
      <h1>{t.name}</h1>
      <dl>
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="muted small">
        These terms are also published in the token's onchain metadata.{" "}
        <a
          href={`https://explorer.solana.com/address/${series.sukukMint}?cluster=devnet`}
          target="_blank"
          rel="noreferrer"
        >
          {short(series.sukukMint)} ↗
        </a>
      </p>
    </section>
  );
}

type Run = (label: string, action: () => Promise<string | undefined>) => Promise<void>;

function InvestorPanel(props: {
  series: Series;
  wallet: Wallet | null;
  setWallet: (w: Wallet) => void;
  busy: boolean;
  run: Run;
}) {
  const { series, wallet, setWallet, busy, run } = props;
  const [state, setState] = useState<{ registered: boolean; units: string; dollars: bigint } | null>(null);
  const [events, setEvents] = useState<ChainEvent[]>([]);
  const address = wallet?.publicKey.toBase58();

  const refresh = useCallback(async () => {
    if (!wallet || !address) return;
    const payment = {
      mint: new PublicKey(series.paymentMint),
      decimals: series.paymentDecimals,
      programId: TOKEN_PROGRAM_ID,
    };
    const [investor, dollars] = await Promise.all([api.investor(address), dollarBalance(wallet.publicKey, payment)]);
    setState({ ...investor, dollars });
    // History comes from the indexer, which may lag the chain by a few seconds or be offline.
    api.events(address).then(setEvents, () => setEvents([]));
  }, [wallet, address, series]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  if (!wallet || !address) {
    return (
      <section className="card">
        <h2>Connect to invest</h2>
        <p className="muted">Use a throwaway test wallet in this browser, or Phantom set to devnet.</p>
        <div className="row">
          <button type="button" className="primary" onClick={() => setWallet(burnerWallet())}>
            Use a test wallet
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run("Phantom connected", async () => void setWallet(await connectPhantom()))}
          >
            Connect Phantom
          </button>
        </div>
      </section>
    );
  }

  const act = (label: string, action: () => Promise<string>) =>
    run(label, async () => {
      const signature = await action();
      await refresh();
      return signature;
    });
  const onSubmit = (handler: (data: FormData) => void) => (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handler(new FormData(e.currentTarget));
  };

  return (
    <section className="card">
      <h2>Your position</h2>
      <div className="stats">
        <Stat label="Sukuk units" value={state?.units ?? "…"} />
        <Stat label="Test dollars" value={state ? usd(state.dollars, series.paymentDecimals) : "…"} />
        <Stat label="KYC" value={state ? (state.registered ? "Approved" : "Not approved") : "…"} />
      </div>
      <p className="muted small">
        Your address: <code>{address}</code>
      </p>

      <h3>1. Get test dollars</h3>
      <button
        type="button"
        disabled={busy}
        onClick={() => act("Test dollars received", async () => (await api.faucet(address)).signature)}
      >
        Request $1,000
      </button>

      <h3>2. Pass KYC</h3>
      <p className="muted small">
        {state?.registered
          ? "You are a registered investor for this series."
          : "Ask the operator to approve your address (Operator tab). Until then your sukuk account stays frozen."}
      </p>

      <h3>3. Subscribe</h3>
      <form
        className="row"
        onSubmit={onSubmit((d) => act("Subscription settled", () => subscribe(wallet, Number(d.get("units")))))}
      >
        <input
          name="units"
          type="number"
          min="1"
          max={series.terms.maxHolding}
          defaultValue="10"
          required
          aria-label="Units"
        />
        <button type="submit" className="primary" disabled={busy}>
          Subscribe at {usd(series.terms.unitValue, series.paymentDecimals)} per unit
        </button>
      </form>

      <h3>Transfer to another investor</h3>
      <form
        className="row"
        onSubmit={onSubmit((d) =>
          act("Transfer settled", () => transfer(wallet, series, String(d.get("to")).trim(), Number(d.get("units")))),
        )}
      >
        <input name="to" placeholder="Recipient address" required aria-label="Recipient address" />
        <input name="units" type="number" min="1" defaultValue="1" required aria-label="Units" />
        <button type="submit" disabled={busy}>
          Send
        </button>
      </form>
      <p className="muted small">
        The recipient must be a registered investor and stay within the holding cap, or the chain rejects it.
      </p>

      <h3>History</h3>
      <EventList events={events} self={address} decimals={series.paymentDecimals} />
    </section>
  );
}

function OperatorPanel({ busy, run }: { busy: boolean; run: Run }) {
  const [token, setToken] = useState(() => sessionStorage.getItem("tsamara-admin") ?? "");
  const [holders, setHolders] = useState<Holder[]>([]);
  const refresh = useCallback(() => api.holders().then(setHolders, () => setHolders([])), []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const saveToken = (value: string) => {
    setToken(value);
    sessionStorage.setItem("tsamara-admin", value);
  };

  return (
    <section className="card">
      <h2>Operator</h2>
      <p className="muted small">
        Compliance and issuer actions are signed by the operator API. They require its admin token.
      </p>
      <input
        type="password"
        placeholder="Admin token"
        value={token}
        onChange={(e) => saveToken(e.target.value)}
        aria-label="Admin token"
      />

      <h3>Approve an investor</h3>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          run("Investor approved", async () => {
            const { signature } = await api.kyc(token, String(d.get("wallet")).trim(), String(d.get("jurisdiction")));
            await refresh();
            return signature;
          });
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
        <button type="submit" className="primary" disabled={busy}>
          Approve
        </button>
      </form>

      <h3>Pay the periodic distribution</h3>
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          run("Distribution paid", async () => {
            const { signature } = await api.distribute(token);
            return signature;
          })
        }
      >
        Pay all holders pro rata
      </button>

      <h3>Holders</h3>
      {holders.length === 0 ? (
        <p className="muted small">No holders yet, or the indexer is not running.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Investor</th>
              <th>Units</th>
              <th>KYC</th>
            </tr>
          </thead>
          <tbody>
            {holders.map((h) => (
              <tr key={h.wallet}>
                <td title={h.wallet}>{short(h.wallet)}</td>
                <td>{h.units}</td>
                <td>{h.approved ? "Approved" : "Frozen"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EventList({ events, self, decimals }: { events: ChainEvent[]; self: string; decimals: number }) {
  if (events.length === 0) return <p className="muted small">Nothing yet.</p>;
  const describe = (e: ChainEvent) => {
    if (e.kind === "approved") return "KYC approved";
    if (e.kind === "revoked") return "KYC revoked";
    if (e.kind === "subscription") return `Subscribed ${e.units} units for ${usd(e.amount, decimals)}`;
    if (e.kind === "distribution") return `Received ${usd(e.amount, decimals)} distribution`;
    return e.wallet === self ? `Received ${e.units} units` : `Sent ${e.units} units`;
  };
  return (
    <ul className="events">
      {events.map((e) => (
        <li key={e.signature + e.kind + e.wallet}>
          <span>{describe(e)}</span>
          <a href={explorer(e.signature)} target="_blank" rel="noreferrer">
            {e.time ? new Date(e.time * 1000).toLocaleString() : "pending"} ↗
          </a>
        </li>
      ))}
    </ul>
  );
}
