"use client";

// Small presentational pieces shared by every page.
import { explorer } from "@/lib/chain";
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
