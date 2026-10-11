"use client";

import Link from "next/link";
import { type Asset, rate } from "@/lib/assets";
import { usd } from "@/lib/chain";
import { AssetIcon, Sparkline, StatusPill } from "./ui";

/** A series as a card: used by the grid view and by "Investors also own". */
export function AssetCard({ asset, decimals, chart }: { asset: Asset; decimals: number; chart: number[] }) {
  const body = (
    <>
      <header>
        <AssetIcon symbol={asset.symbol} size={32} />
        <span>
          <strong>{asset.symbol}</strong>
          <small>{asset.name}</small>
        </span>
      </header>
      <div className={`asset-card-body ${asset.live ? "" : "muted-body"}`}>
        <p className="figure small">{usd(asset.unitValue, decimals)}</p>
        <p className={asset.live ? "up" : "muted"}>
          {rate(asset.profitRateBps)} expected · {asset.maturity.slice(0, 4)}
        </p>
        <Sparkline points={asset.live ? chart : []} muted={!asset.live} width={220} height={64} />
      </div>
      <footer>
        <StatusPill live={asset.live} />
        <small className="muted">{asset.akad}</small>
      </footer>
    </>
  );
  return asset.live ? (
    <Link className="asset-card" href={`/assets/${asset.symbol.toLowerCase()}`}>
      {body}
    </Link>
  ) : (
    <div className="asset-card">{body}</div>
  );
}
