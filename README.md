# Tsamara

Sovereign sukuk for everyone: buy from $10 in USDC, trade any time, receive distributions onchain.

> Devnet prototype built for the Colosseum Crypto World's Fair hackathon. The sukuk series is a mock; this is not a real issuance or an offer of securities.

## Why

Sukuk are the fixed-income instrument of Islamic finance: asset-backed certificates that pay a share of profit instead of interest. Sovereign dollar sukuk are sold to institutions in large minimum denominations and trade over the counter, so most investors who want a sharia-compliant, dollar-denominated, government-backed return cannot buy one directly.

Tsamara represents a sukuk series as a token with a small unit size. A KYC'd investor in any jurisdiction where the series is offered can hold a fraction, settle in stablecoins, and sell to another approved investor at any time.

## How it works

Every transfer rule is enforced by Solana's Token-2022 program. There is no custom onchain program to audit.

| Rule | Mechanism |
|---|---|
| Series terms (akad, maturity, currency, profit rate, unit size, restricted jurisdictions) are public | Token metadata stored on the mint |
| Only approved investors can hold the sukuk | Token accounts are frozen by default; the compliance authority thaws them |
| The issuer cannot decide who holds | Mint authority and freeze authority are separate keys |
| Subscription and trades cannot half-settle | Payment and delivery are two instructions in one transaction |
| Distributions are paid pro rata | Stablecoin transfers from the issuer treasury, computed from holdings |

Jurisdiction eligibility is published in the series metadata and checked when the compliance authority approves an investor. The check itself runs offchain today; see the open issues for what is and is not enforced onchain.

The payment token is configurable (mint, decimals, token program). The demo uses a mock dollar token with the same token program and decimals as USDC.

## Repository layout

```
packages/sukuk       Instruction builders: issuance, KYC, settlement, distribution
apps/devnet-demo     End-to-end lifecycle on devnet, also the integration check
```

## Run it

Requires [Bun](https://bun.sh).

```sh
bun install
bun test          # unit tests
bun run demo      # full lifecycle on devnet, prints explorer links
```

The first `bun run demo` prints an issuer address. Fund it with devnet SOL from https://faucet.solana.com and run again.

## Status

This is a prototype. It is not compliance-ready or production-ready, and it does not claim any regulatory approval or sharia certification. The gaps are tracked as issues labelled [`compliance`](https://github.com/tsamara-xyz/tsamara/labels/compliance) and [`production`](https://github.com/tsamara-xyz/tsamara/labels/production).

## License

MIT
