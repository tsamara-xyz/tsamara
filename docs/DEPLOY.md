# Deployment

Five containers, one per service. Each has a Dockerfile and reads its configuration from the environment.

| Service | Dockerfile | Build context | Port | Public URL |
|---|---|---|---|---|
| Landing | `apps/landing/Dockerfile` | repository root | 80 | https://tsamara.xyz |
| App | `apps/app/Dockerfile` | repository root | 3000 | https://app.tsamara.xyz |
| API | `apps/api/Dockerfile` | repository root | 8788 | https://api.tsamara.xyz |
| Indexer | `apps/indexer/Dockerfile` | `apps/indexer` | 8787 | https://indexer.tsamara.xyz |
| Docs | `apps/docs/Dockerfile` | `apps/docs` | 3000 | https://docs.tsamara.xyz |

## Configuration

| Service | Variable | Meaning |
|---|---|---|
| App (build time) | `NEXT_PUBLIC_API`, `NEXT_PUBLIC_INDEXER` | Public URLs of the API and the indexer, compiled into the bundle |
| App (build time) | `NEXT_PUBLIC_RPC` | Optional Solana RPC endpoint; defaults to public devnet |
| API | `ISSUER_KEY`, `COMPLIANCE_KEY` | Operator keys as JSON byte arrays. Devnet keys only |
| API | `SUKUK_MINT`, `PAYMENT_MINT` | The live series to serve |
| API | `ADMIN_TOKEN` | Required by `/admin` routes |
| API | `INDEXER` | URL of the indexer, used for the holder list |
| API | `SUMSUB_TOKEN`, `SUMSUB_SECRET` | Optional sandbox credentials; without them the operator approves by hand |
| API, Indexer | `RPC` | Optional Solana RPC endpoint |
| Indexer | `SUKUK_MINT`, `PAYMENT_MINT`, `ISSUER` | The series to index |

The indexer keeps its SQLite database in `/srv/.data`. Without a volume it rebuilds the index from the chain on every start, which is fine at this size.

The series is created once by starting the API locally with funded devnet keys (`bun run api`); its addresses are written to `.keys/series.json`.

## Current deployment

The five services run on a single VPS under Coolify, in a project named `tsamara`, built from `main` of this repository with the Dockerfiles above. The server's own nginx terminates TLS and proxies each hostname to a port published on the host.

| Service | Coolify application | Host port |
|---|---|---|
| Landing | `tsamara-landing` | 3113 |
| App | `tsamara-app` | 3114 |
| API | `tsamara-api` | 3112 |
| Indexer | `tsamara-indexer` | 3111 |
| Docs | `tsamara-docs` | 3115 |

Things that are easy to get wrong:

- **The API reaches the indexer over the Docker network**, at `http://tsamara-indexer:8787`. The indexer application has the custom network alias `tsamara-indexer`; a container cannot reach a port published on its own host here. An alias only takes effect on a full deploy, not a restart.
- **`NEXT_PUBLIC_API` and `NEXT_PUBLIC_INDEXER` are build variables** of the app. Changing them means rebuilding it.
- **Builds run on the server and the disk is small.** Each round of builds leaves several gigabytes of build cache; reclaim it with `docker builder prune --force`, which removes unused cache only.
- **The indexer serves only after it has caught up**, so it answers a little after its container starts.
- The host ports are published on all interfaces, because the Coolify API does not accept a loopback binding. Bind them to `127.0.0.1` in the Coolify UI if the firewall does not already cover them.

To check a deployment end to end, run the API smoke test against it:

```sh
API=https://api.tsamara.xyz INDEXER=https://indexer.tsamara.xyz ADMIN_TOKEN=... bun apps/api/smoke.ts
```
