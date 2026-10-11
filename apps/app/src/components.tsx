import { type FormEvent, useEffect, useRef, useState } from "react";
import { api, explorer, short, subscribe, transfer, usd } from "./chain";
import { useStore } from "./store";

export function AssetIcon({ symbol, size = 36 }: { symbol: string; size?: number }) {
  return (
    <span className="asset-icon" style={{ width: size, height: size, fontSize: size * 0.3 }} aria-hidden="true">
      {symbol.slice(0, 2)}
    </span>
  );
}

export function Sparkline({
  points,
  width = 120,
  height = 36,
  muted = false,
}: {
  points: number[];
  width?: number;
  height?: number;
  muted?: boolean;
}) {
  const data = points.length > 1 ? points : [0, 0];
  const max = Math.max(...data, 1);
  const step = width / (data.length - 1);
  const line = data
    .map((v, i) => `${(i * step).toFixed(1)},${(height - 3 - (v / max) * (height - 6)).toFixed(1)}`)
    .join(" ");
  return (
    <svg
      className={`spark ${muted ? "muted" : ""}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Units outstanding over time"
    >
      <polygon points={`0,${height} ${line} ${width},${height}`} />
      <polyline points={line} />
    </svg>
  );
}

export function StatusPill({ live }: { live: boolean }) {
  return <span className={`status ${live ? "open" : ""}`}>{live ? "Open on devnet" : "Preview"}</span>;
}

export function NoticeBar() {
  const { notice, dismiss } = useStore();
  if (!notice) return null;
  return (
    <div className={`notice ${notice.tone}`} role="status">
      <span>
        {notice.text}{" "}
        {notice.signature && (
          <a href={explorer(notice.signature)} target="_blank" rel="noreferrer">
            View transaction ↗
          </a>
        )}
      </span>
      <button type="button" className="link" onClick={dismiss} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}

export function ConnectButtons() {
  const { connect, busy } = useStore();
  return (
    <div className="row">
      <button type="button" className="btn primary" disabled={busy} onClick={() => connect("burner")}>
        Use a test wallet
      </button>
      <button type="button" className="btn" disabled={busy} onClick={() => connect("phantom")}>
        Connect Phantom
      </button>
    </div>
  );
}

declare global {
  interface Window {
    // The Sumsub WebSDK builder, loaded from their CDN on demand.
    snsWebSdk?: { init(token: string, refresh: () => Promise<string>): SumsubBuilder };
  }
}
interface SumsubBuilder {
  withConf(conf: object): SumsubBuilder;
  withOptions(options: object): SumsubBuilder;
  on(event: string, handler: (payload: unknown) => void): SumsubBuilder;
  build(): { launch(selector: string): void };
}

const loadSumsub = () =>
  new Promise<void>((resolve, reject) => {
    if (window.snsWebSdk) return resolve();
    const script = document.createElement("script");
    script.src = "https://static.sumsub.com/idensic/static/sns-websdk-builder.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the verification widget"));
    document.head.append(script);
  });

/** Identity verification in a dialog. The widget is only UX: approval is decided by the API from Sumsub's own record. */
export function KycDialog({ onClose }: { onClose: () => void }) {
  const { wallet, refresh } = useStore();
  const address = wallet?.publicKey.toBase58() ?? "";
  const [phase, setPhase] = useState<"loading" | "widget" | "checking" | "approved" | "failed">("loading");
  const [message, setMessage] = useState("");
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    // ponytail: asks the API a few times after the widget reports a submission; a webhook replaces this once the API is public.
    const check = async (attempt: number) => {
      if (cancelled) return;
      const result = await api
        .kycComplete(address)
        .catch((e: Error) => ({ status: "error" as const, reason: e.message }));
      if (cancelled) return;
      if (result.status === "approved") {
        setPhase("approved");
        return refresh();
      }
      if (result.status === "rejected" || result.status === "error") {
        setMessage(result.reason ?? "Verification was not approved");
        return setPhase("failed");
      }
      if (attempt >= 36) {
        setMessage("Still in review. Close this window and check again later.");
        return setPhase("failed");
      }
      timer = setTimeout(() => check(attempt + 1), 5000);
    };

    const token = async () => (await api.kycToken(address)).token;
    (async () => {
      await loadSumsub();
      const first = await token();
      if (cancelled || !window.snsWebSdk) return;
      window.snsWebSdk
        .init(first, token)
        .withConf({ lang: "en", theme: "light" })
        .withOptions({ addViewportTag: false, adaptIframeHeight: true })
        .on("idCheck.onReady", () => setPhase((p) => (p === "loading" ? "widget" : p)))
        .on("idCheck.onApplicantSubmitted", () => {
          setPhase("checking");
          check(0);
        })
        .on("idCheck.onError", (payload) => {
          setMessage(String((payload as { reason?: string })?.reason ?? "The verification widget reported an error"));
          setPhase("failed");
        })
        .build()
        .launch("#sumsub-websdk-container");
    })().catch((e: Error) => {
      setMessage(e.message);
      setPhase("failed");
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      // React mounts effects twice in development; without this two widgets stack.
      container.current?.replaceChildren();
    };
  }, [address, refresh]);

  const checkNow = async () => {
    const result = await api.kycComplete(address).catch(() => null);
    if (result?.status !== "approved") return;
    setPhase("approved");
    await refresh();
  };

  return (
    <div className="overlay">
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Verify your identity">
        <header>
          <h2>Verify your identity</h2>
          <button type="button" className="link" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <p className="muted small">
          Verification is run by Sumsub in sandbox mode. Approval is recorded onchain for {short(address)}.
        </p>
        {phase === "approved" && (
          <p className="notice ok">Approved. Your investor record is onchain and your sukuk account is open.</p>
        )}
        {phase === "failed" && <p className="notice error">{message}</p>}
        {phase === "checking" && (
          <p className="notice">
            Submitted. Waiting for the review. In the sandbox, the operator can complete it from the Operator page.{" "}
            <button type="button" className="link" onClick={checkNow}>
              Check now
            </button>
          </p>
        )}
        <div className="kyc-stage" hidden={phase === "approved"}>
          <div id="sumsub-websdk-container" ref={container} />
          {phase === "loading" && <div className="kyc-loader">Loading verification…</div>}
        </div>
      </div>
    </div>
  );
}

/** The buy / send panel on an asset page. Walks an investor through the steps they still need. */
export function TradePanel() {
  const { series, wallet, position, busy, run } = useStore();
  const [tab, setTab] = useState<"buy" | "send">("buy");
  const [units, setUnits] = useState(10);
  const [verifying, setVerifying] = useState(false);
  if (!series) return null;
  const price = BigInt(series.terms.unitValue);
  const cost = price * BigInt(Math.max(units, 0));
  const address = wallet?.publicKey.toBase58() ?? "";

  const onSend = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    if (wallet)
      run("Transfer settled", () => transfer(wallet, series, String(data.get("to")).trim(), Number(data.get("units"))));
  };

  return (
    <aside className="card trade">
      <div className="segmented">
        <button type="button" className={tab === "buy" ? "on" : ""} onClick={() => setTab("buy")}>
          Buy
        </button>
        <button type="button" className={tab === "send" ? "on" : ""} onClick={() => setTab("send")}>
          Send
        </button>
      </div>

      {!wallet ? (
        <>
          <p className="muted">Connect a wallet to invest. Phantom must be set to devnet.</p>
          <ConnectButtons />
        </>
      ) : tab === "buy" ? (
        <>
          <label className="field">
            <span>Units</span>
            <input
              type="number"
              min={1}
              max={Number(series.terms.maxHolding)}
              value={units}
              onChange={(e) => setUnits(Number(e.target.value))}
            />
          </label>
          <dl className="quote">
            <div>
              <dt>Price per unit</dt>
              <dd>{usd(price, series.paymentDecimals)}</dd>
            </div>
            <div>
              <dt>You pay</dt>
              <dd>{usd(cost, series.paymentDecimals)}</dd>
            </div>
            <div>
              <dt>Your test dollars</dt>
              <dd>{position ? usd(position.dollars, series.paymentDecimals) : "…"}</dd>
            </div>
          </dl>
          {position && position.dollars < cost ? (
            <button
              type="button"
              className="btn primary wide"
              disabled={busy}
              onClick={() => run("Test dollars received", async () => (await api.faucet(address)).signature)}
            >
              Get $1,000 test dollars
            </button>
          ) : position && !position.registered ? (
            <>
              <button
                type="button"
                className="btn primary wide"
                disabled={busy}
                onClick={() => (series.kyc === "sumsub" ? setVerifying(true) : undefined)}
              >
                {series.kyc === "sumsub" ? "Verify identity to continue" : "Awaiting operator approval"}
              </button>
              <p className="muted small">Your sukuk account stays frozen until you are a registered investor.</p>
            </>
          ) : (
            <button
              type="button"
              className="btn primary wide"
              disabled={busy || units < 1}
              onClick={() => wallet && run("Subscription settled", () => subscribe(wallet, units))}
            >
              Subscribe
            </button>
          )}
          <p className="muted small">Payment and delivery settle in one transaction, signed by you and the issuer.</p>
        </>
      ) : (
        <form onSubmit={onSend}>
          <label className="field">
            <span>Recipient address</span>
            <input name="to" required placeholder="Registered investor's address" />
          </label>
          <label className="field">
            <span>Units (you hold {position ? String(position.units) : "…"})</span>
            <input name="units" type="number" min={1} defaultValue={1} required />
          </label>
          <button type="submit" className="btn primary wide" disabled={busy}>
            Send
          </button>
          <p className="muted small">
            The chain rejects the transfer unless the recipient is registered and stays within the holding cap.
          </p>
        </form>
      )}
      {verifying && <KycDialog onClose={() => setVerifying(false)} />}
    </aside>
  );
}
