# Tsamara

Tokenized Indonesian sovereign retail sukuk (SBSN) on Solana: buy from Rp10.000, trade any time, receive monthly imbalan onchain.

> Devnet prototype built for the Colosseum Crypto World's Fair hackathon. The sukuk series is a mock; this is not a real issuance or an offer of securities.

## How it works

Every rule is enforced by Solana's Token-2022 program. There is no custom onchain program to audit.

| Rule | Mechanism |
|---|---|
| Series terms (akad, maturity, imbalan, unit size) are public | Token metadata stored on the mint |
| Only KYC'd investors can hold the sukuk | Token accounts are frozen by default; the issuer thaws them |
| Subscription and trades cannot half-settle | Payment and delivery are two instructions in one transaction |
| Imbalan is paid pro rata | Rupiah transfers from the issuer treasury, computed from holdings |

## Repository layout

```
packages/sukuk       Instruction builders: issuance, KYC, settlement, imbalan
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

## License

MIT
