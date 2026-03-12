# Chaingrep

Chaingrep is a browser-first EVM event search tool.

The basic idea is simple: point it at a contract, choose a block range, resolve an ABI, and grep through historical events without standing up an indexer.

It is intentionally closer to "grep for contract events" than an analytics platform.

## What It Does

- query historical logs with `eth_getLogs`
- decode events from ABI data
- stream progress while queries run
- export results as CSV or JSON
- support both hosted sample mode and direct BYOK RPC mode

## Two Modes

### `Sample`

- browser -> API -> chain RPC
- meant to be genuinely usable for quick testing and lightweight real queries
- intentionally rate-limited and capped
- powered by server-owned sample RPC URLs in `apps/api/.env`

The hosted sample mode is not just a tiny demo. For a lot of quick contract/event lookups, it should be enough on its own. If you need bigger ranges, heavier usage, or stronger guarantees, use direct BYOK mode or self-host.

The default hosted posture is currently:

- `10,000` blocks per query
- `10` sample queries per IP per `15` minutes
- one in-flight sample query per IP

### `Direct BYOK`

- browser -> your RPC directly
- best path for serious usage
- your RPC URLs and optional Etherscan key are stored locally in your browser for convenience

Important caveat: direct mode depends on the selected RPC allowing browser CORS.
Those values are not sent to the backend in direct mode, but `localStorage` is not hardened secret storage.

## Supported Chains

- Ethereum
- Sepolia
- Polygon
- Base

## Quick Start

### Prerequisites

- Node 22+
- `pnpm` 10+

### Local Dev

1. Install dependencies:

```bash
pnpm install
```

2. Create the API env file:

```bash
cp apps/api/.env.example apps/api/.env
```

3. Add whichever sample RPC URLs you want to support:

- `SAMPLE_ETHEREUM_RPC_URL`
- `SAMPLE_SEPOLIA_RPC_URL`
- `SAMPLE_POLYGON_RPC_URL`
- `SAMPLE_BASE_RPC_URL`
- optional rate-limit tuning via `SAMPLE_QUERY_LIMIT` and `SAMPLE_RATE_WINDOW_MS`

4. Start the apps:

```bash
pnpm dev
```

5. Open:

- web: `http://localhost:5173`
- API health check: `http://localhost:8787/health`

## Good First Query

If you want a quick smoke test:

- mode: `Sample`
- chain: `Ethereum`
- contract: `0x1F98431c8aD98523631AE4a59f267346ea31F984`
- from block: `24637226`
- to block: `24637326`
- event: `PoolCreated`

Expected result:

- ABI resolves in the browser
- the API streams progress
- decoded logs show up in the results table

## Self-Hosting

Chaingrep is meant to be easy to self-host.

If you want stronger RPC access, larger query volume, or just don’t want to rely on a shared hosted sample mode, self-hosting is the intended path.

Docker support is included:

1. Create `apps/api/.env` from `apps/api/.env.example`
2. Optionally create `apps/web/.env`
3. Run:

```bash
docker compose up --build
```

The compose stack exposes:

- web UI: `http://localhost:4173`
- sample API: `http://localhost:8787`

## Repo Layout

This is a monorepo:

- `apps/web`: Vite + React SPA
- `apps/api`: Hono API for sample mode
- `packages/shared`: shared schemas, chain config, ABI helpers, query runner, exporters
- [`PLAN.md`](./PLAN.md): more detailed implementation notes / handoff doc

## Common Scripts

Run from the repo root:

- `pnpm dev`
- `pnpm dev:web`
- `pnpm dev:api`
- `pnpm build`
- `pnpm test`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm check`

## Notes

- Sample mode is guardrailed, but meant to be useful.
- The default hosted sample cap is `10,000` blocks per query.
- The default hosted sample rate limit is `10` queries per IP per `15` minutes.
- Serious usage is expected to come from direct BYOK mode or self-hosting.
- Keep real RPC URLs and API keys out of git.
- Browser-stored keys are local-only convenience settings, not hardened secret storage.
- Server-owned sample RPC URLs belong in `apps/api/.env`.

## PRs / Collab

If you want to hack on this, open an issue or send a PR.

No big process here. Small fixes, chain support improvements, query runner improvements, UX polish, and self-hosting quality-of-life changes are all fair game.

If you add or remove a chain, update the shared package, API wiring, this README, and [`PLAN.md`](./PLAN.md) together.
