# ⛓ chaingrep

grep for on-chain events.

Point it at a contract, pick a block range, and search through decoded events. No indexer, no SQL, no setup.

**[chaingrep.xyz](https://chaingrep.xyz)**

## How it works

1. Enter a contract address and block range
2. Chaingrep resolves the ABI automatically (manual paste override, otherwise Sourcify → Etherscan)
3. Pick an event name to filter, or search all events
4. Results stream in as they're fetched, with full decoded args
5. Export to CSV or JSON when you're done

That's it. No accounts, no API keys required for basic use.

## Works out of the box

No setup needed. Queries go through a small hosted API with sensible rate limits (10K blocks per query, 10 queries per 15 min). Good enough for most quick lookups.

**Bring your own RPC:** plug in your own RPC URL in settings and queries go straight from your browser to the chain. Nothing touches our server. No rate limits, no block range caps. Your keys live in localStorage (convenient, not Fort Knox, treat accordingly). The app auto-detects which mode to use based on whether you have an RPC saved for the selected chain.

## Supported chains

Ethereum · Sepolia · Polygon · Base

## Try it

Quick smoke test if you want to kick the tyres:

- **Chain:** Ethereum
- **Contract:** `0x1F98431c8aD98523631AE4a59f267346ea31F984` (Uniswap V3 Factory)
- **From:** `24637226` → **To:** `24637326`
- **Event:** PoolCreated

## Run it locally

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
# Add your RPC URLs to apps/api/.env
pnpm dev
```

Web UI at `localhost:5173`, API at `localhost:8787`.

Needs Node 22+ and pnpm 10+.

## Self-host

```bash
docker compose up --build
```

If you want bigger query ranges, no rate limits, or just prefer to run your own thing then self-hosting is the intended path. Docker setup is included and straightforward.

## Repo layout

```
apps/web          Vite + React frontend
apps/api          Hono API (sample mode proxy + rate limiting)
packages/shared   Query engine, ABI resolution, chain config, exporters
```

Monorepo with pnpm workspaces. `pnpm dev` starts everything.

## Contributing

Open an issue or send a PR. No ceremony — small fixes, new chains, UX improvements, query engine tweaks are all welcome.

If you add or remove a chain, update `packages/shared`, `apps/api`, this README, and [`PLAN.md`](./PLAN.md) together.

## License

MIT
