# Chaingrep Plan

This file replaces `USER-PLAN.md`. It is the living implementation plan and handoff guide for future agents.

If the architecture, supported chains, query limits, or secret-handling rules change, update this file and `README.md` together.

## Product Position

- Chaingrep is a browser-first EVM event search tool.
- The product goal is "grep for contract events", not a general indexer, analytics platform, or saved-query product.
- The hosted app should feel polished and useful for public/community usage.
- Serious usage is expected to come from `Direct BYOK` mode or self-hosting.
- Simplicity and fast debugging matter more than feature breadth.

## Current Architecture

- `apps/web`
  - Vite + React 19 SPA
  - TanStack Query for async UI flows
  - Tailwind-based styling with custom UI primitives
  - Lucide icons
- `apps/api`
  - Hono API running on Node
  - Handles anonymous/sample queries only
  - Loads env from `apps/api/.env` first, then falls back to root `.env`
- `packages/shared`
  - Zod schemas
  - Chain registry
  - ABI resolution helpers
  - Provider profile detection
  - Shared log query runner
  - CSV / JSON export helpers

## Runtime Modes

### `Sample` mode

- Request path: browser -> `apps/api` -> chain RPC
- Endpoint: `POST /api/sample/query/stream`
- Response format: NDJSON stream of progress and final result messages
- Intended to be a genuinely usable hosted path for demos and many lightweight public queries
- Uses server-owned sample RPC URLs from `apps/api/.env`
- Enforces strict caps:
  - one in-flight sample query per client IP
  - default `10` sample queries per IP per `15` minutes
  - `SAMPLE_MAX_LOGS` decoded logs
  - block-span cap is `min(SAMPLE_MAX_BLOCK_SPAN, chain.sampleBlockSpan)`
- Current default sample span by chain:
  - Ethereum: 10000 blocks
  - Sepolia: 10000 blocks
  - Polygon: 10000 blocks
  - Base: 10000 blocks

### `Direct BYOK` mode

- Request path: browser -> user RPC directly
- The browser runs the same shared query engine as the API
- User RPC URLs are entered in the UI and stored only in browser `localStorage`
- Direct mode is the main path for power users
- Direct mode currently depends on the RPC provider allowing browser CORS

## Secret Handling Rules

- User-entered RPC URLs live only in browser `localStorage`
- User-entered Etherscan keys live only in browser `localStorage`
- No user-supplied secret is sent to the backend in the current implementation
- `localStorage` is a local-only convenience store, not hardened secret storage
- Do not put RPC URLs, API keys, or manual ABI text into URL state
- Server-owned sample RPC URLs belong only in `apps/api/.env`

## ABI Resolution

ABI resolution is client-side in both modes.

Current precedence:

1. Manual ABI, if the user pasted one
2. Sourcify full match, then partial match
3. Etherscan V2, if the user supplied a key in the UI
4. Empty ABI result

Important consequences:

- The API does not do server-side ABI lookup today
- Sample mode receives the resolved ABI from the browser when one is available
- The event dropdown only becomes useful after ABI resolution
- If a user selects an event filter, an ABI containing that event is required

## Query Engine

The shared query engine lives in `packages/shared/src/lib/queryRunner.ts`.

Current behavior:

- Validates inputs with Zod
- Uses `viem` for `eth_getLogs` and event decoding
- Detects provider profile from RPC hostname
- Starts with a provider-specific chunk size
- Uses provider-specific bounded chunk concurrency
- Grows chunk size after light responses
- Shrinks chunk size after oversized-result errors
- Retries transient errors with backoff
- Emits progress events for the UI and sample stream
- Stops early and marks results as partial when the decoded-log cap is reached

Provider profiles currently exist for:

- Chainnodes
- Alchemy
- Infura / MetaMask
- Custom RPC fallback

Current decoded-log caps:

- Sample mode: controlled by `SAMPLE_MAX_LOGS`, default `2000`
- Direct mode: shared runner default `10000`

## Query Transport Rules

- Shared runtime types use `bigint` block numbers
- Browser-to-API transport must serialize block numbers as strings
- The sample-mode request uses `serializeQueryInputForTransport` for this reason
- If future agents add new API transport shapes, keep them JSON-safe

## Chain Support

Shared chain support currently includes:

- Ethereum
- Sepolia
- Polygon
- Base

Current reality by mode:

- `Direct BYOK`: all shared chains can be configured in the browser
- `Sample`: effectively wired for Ethereum, Sepolia, Polygon, and Base

## Current UX / Product Rules

- Single-page workflow: query form and results live on the same screen
- Dark developer-tool aesthetic
- Mode should always be explicit in the UI
- Settings panel is the place for local-only RPC and Etherscan input
- Results support:
  - progress display
  - cancel
  - CSV export
  - JSON export
  - expandable decoded log rows
  - sorting
  - copy-to-clipboard for important addresses and hashes

Current copy affordances:

- query contract address
- result transaction hash
- emitting log address
- decoded argument values when they look like addresses

## Environment And Setup

### Preferred local API env

Create `apps/api/.env` from `apps/api/.env.example`.

Current variables:

- `SAMPLE_ETHEREUM_RPC_URL`
- `SAMPLE_SEPOLIA_RPC_URL`
- `SAMPLE_POLYGON_RPC_URL`
- `SAMPLE_BASE_RPC_URL`
- `PORT`
- `SAMPLE_MAX_BLOCK_SPAN`
- `SAMPLE_MAX_LOGS`
- `SAMPLE_QUERY_LIMIT`
- `SAMPLE_RATE_WINDOW_MS`

Notes:

- Root `.env` is still supported as a fallback for workspace-level commands
- `apps/api/.env` wins because it is loaded first and later loads do not override existing values
- The web app can optionally use `VITE_API_BASE_URL`
- No server-side Etherscan env is required today

## Self-Hosting

The repo includes:

- `docker-compose.yml`
- `apps/api/Dockerfile`
- `apps/web/Dockerfile`

Self-hosting posture:

- public hosted sample mode should remain guardrailed, but useful by default
- self-hosting is the expected path for teams with stronger RPC access
- do not add auth, databases, or persistence unless the product direction changes materially

## Verification Workflow

Standard checks:

- `pnpm typecheck`
- `pnpm test`
- `pnpm lint`
- `pnpm build`

Useful manual smoke test:

- mode: `Sample`
- chain: `Ethereum`
- contract: `0x1F98431c8aD98523631AE4a59f267346ea31F984`
- from block: `24637226`
- to block: `24637326`
- event: `PoolCreated`

Expected behavior:

- ABI resolves in the browser
- sample query streams progress from the API
- results decode correctly

## Known Constraints

- Sample mode is still rate-limited and capped, even though it is meant to be useful by default
- Direct mode can fail on providers that do not allow browser CORS
- The query runner is adaptive and uses provider-bounded concurrency
- The API rate limiter is in-memory and is not suitable for horizontally scaled production without replacement
- There is no auth, database, saved-query model, or real-time subscription support
- The API trusts the client-supplied ABI for decoding in sample mode

## When Adding A Chain

Update all relevant places together:

- `packages/shared/src/lib/chains.ts`
- `packages/shared/src/lib/schemas.ts`
- `apps/api/src/env.ts`
- `apps/api/.env.example`
- `apps/web` settings and placeholders if needed
- `README.md`
- this file

Check both modes separately:

- can the browser query it directly with a BYOK RPC?
- is sample mode actually wired to a server-side RPC for that chain?

## Near-Term Follow-Ups

These are the most sensible next improvements if work continues:

- add a small browser E2E smoke test around sample mode
- decide whether server-side Etherscan fallback is worth adding for sample mode
- revisit result virtualization only if row detail rendering still becomes a bottleneck on much larger datasets
