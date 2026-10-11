import { useState } from "react";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { short } from "./chain";
import { NoticeBar } from "./components";
import { AssetPage, ExplorePage, OperatorPage, PortfolioPage } from "./pages";
import { StoreProvider, useStore } from "./store";

function TopNav({ query, setQuery }: { query: string; setQuery: (value: string) => void }) {
  const { wallet, connect, busy } = useStore();
  return (
    <header className="nav">
      <NavLink className="brand" to="/">
        <img src="/android-chrome-192x192.png" width="28" height="28" alt="" />
        <span>Tsamara</span>
      </NavLink>
      <nav>
        <NavLink to="/" end>
          Explore
        </NavLink>
        <NavLink to="/portfolio">Portfolio</NavLink>
        <NavLink to="/operator">Operator</NavLink>
        <a href="https://github.com/tsamara-xyz/tsamara" target="_blank" rel="noreferrer">
          Resources
        </a>
      </nav>
      <input
        className="search"
        type="search"
        placeholder="Search series"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
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
      <p>
        <strong>Tsamara</strong> © 2026 · <a href="https://tsamara.xyz">tsamara.xyz</a> ·{" "}
        <a href="https://github.com/tsamara-xyz/tsamara/blob/main/docs/COMPLIANCE.md" target="_blank" rel="noreferrer">
          Compliance mapping
        </a>
      </p>
      <p>
        Tsamara is a prototype running on Solana devnet with a mock sukuk series and test dollars that have no value.
        Nothing on this site is an offer or solicitation to buy or sell securities, and no investment can be made here.
        Tsamara holds no licence, has no regulatory approval and no sharia certification.
      </p>
      <p>
        Identity verification runs in Sumsub's sandbox. The compliance program is unaudited. Series marked Preview are
        illustrations: they are not issued, not onchain and cannot be bought.
      </p>
    </footer>
  );
}

export function App() {
  const [query, setQuery] = useState("");
  return (
    <StoreProvider>
      <BrowserRouter>
        <div className="shell">
          <TopNav query={query} setQuery={setQuery} />
          <NoticeBar />
          <main>
            <Routes>
              <Route path="/" element={<ExplorePage query={query} />} />
              <Route path="/portfolio" element={<PortfolioPage />} />
              <Route path="/assets/:symbol" element={<AssetPage />} />
              <Route path="/operator" element={<OperatorPage />} />
              <Route path="*" element={<p className="muted pad">Page not found.</p>} />
            </Routes>
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </StoreProvider>
  );
}
