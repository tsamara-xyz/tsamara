"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { short } from "@/lib/chain";
import { useStore } from "./store";
import { NoticeBar } from "./ui";

const LINKS = [
  { href: "/", label: "Explore" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/operator", label: "Operator" },
];

function TopNav() {
  const { wallet, connect, busy, search, setSearch } = useStore();
  const pathname = usePathname();
  return (
    <header className="nav">
      <Link className="brand" href="/">
        <img src="/android-chrome-192x192.png" width="28" height="28" alt="" />
        <span>Tsamara</span>
      </Link>
      <nav>
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className={pathname === link.href ? "active" : ""}>
            {link.label}
          </Link>
        ))}
        <a href="https://github.com/tsamara-xyz/tsamara" target="_blank" rel="noreferrer">
          Resources
        </a>
      </nav>
      <input
        className="search"
        type="search"
        placeholder="Search series"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search series"
      />
      <span className="chip">Devnet</span>
      {wallet ? (
        <span className="chip" title={wallet.publicKey.toBase58()}>
          {wallet.kind === "burner" ? "Test wallet" : "Phantom"} · {short(wallet.publicKey.toBase58())}
        </span>
      ) : (
        <button type="button" className="btn dark" disabled={busy} onClick={() => connect("burner")}>
          Connect
        </button>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer>
      <div className="footer-bar">
        <strong>Tsamara © 2026</strong>
        <a href="https://tsamara.xyz">tsamara.xyz</a>
        <a href="https://github.com/tsamara-xyz/tsamara/blob/main/docs/COMPLIANCE.md" target="_blank" rel="noreferrer">
          Compliance mapping
        </a>
        <a href="https://github.com/tsamara-xyz/tsamara/blob/main/docs/REGULATION.md" target="_blank" rel="noreferrer">
          Regulatory notes
        </a>
        <a className="footer-end" href="https://github.com/tsamara-xyz/tsamara" target="_blank" rel="noreferrer">
          GitHub ↗
        </a>
      </div>
      <div className="disclaimer">
        <p>
          Tsamara is a prototype running on Solana devnet with a mock sukuk series and test dollars that have no value.
          Nothing on this site is an offer or solicitation to buy or sell securities, and no investment can be made
          here. Tsamara holds no licence, has no regulatory approval and no sharia certification, and is not affiliated
          with any sovereign issuer.
        </p>
        <p>
          A real offering would be limited to eligible investors in jurisdictions where it is authorised. The demo
          series is not offered to residents of the United States or Indonesia. A unit in a real series would be a
          beneficial share in sukuk held on trust; the token in this prototype represents nothing.
        </p>
        <p>
          The expected profit rate is an expectation set by the structure, not a guarantee. Identity verification runs
          in Sumsub's sandbox. The compliance program is unaudited. Series marked Preview are illustrations: they are
          not issued, not onchain and cannot be bought.
        </p>
      </div>
    </footer>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <TopNav />
      <NoticeBar />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
