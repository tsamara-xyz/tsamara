# Tsamara docs

The documentation for [Tsamara](https://tsamara.xyz), served at
[docs.tsamara.xyz](https://docs.tsamara.xyz). Pages are MDX under `content/docs`; the site is
[Fumadocs](https://fumadocs.dev) on Next.js.

This workspace is a standalone pnpm project inside the monorepo: it has its own lockfile, Biome
configuration and Dockerfile, and is not part of the Bun workspace.

## Run

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build
pnpm lint         # Biome
pnpm lint:links   # every internal link resolves
```

Copy `.env.example` to `.env` to override `NEXT_PUBLIC_SITE_URL`, the canonical origin used by
the sitemap, the social cards and the metadata.

## Deploy

`Dockerfile` builds a standalone Next.js server, with `apps/docs` as the build context. See
`docs/DEPLOY.md` at the repository root.

## Where it comes from

The pages are written from the repository's own README, `docs/COMPLIANCE.md` and
`docs/REGULATION.md`, and say what is proven and what is not. The template is
[tailwind-variants-docs](https://github.com/heroui-inc/tailwind-variants-docs) by HeroUI, MIT;
the content and the branding are Tsamara's.

## License

MIT. See [`LICENSE`](LICENSE).
