# AGENTS.md

Instructions for coding agents working in this repository. Project overview: [README.md](README.md). Details: [docs/architecture.md](docs/architecture.md), [docs/calculation.md](docs/calculation.md), [docs/deployment.md](docs/deployment.md).

## Stack

Vite, React 19, TypeScript, Tailwind 4, shadcn/ui (Radix), Recharts, `decimal.js`, MSW (browser mock backend), Vitest. Deployed as Cloudflare Workers static assets in SPA mode. Package manager: pnpm only.

## Commands

```sh
pnpm dev              # dev server
pnpm test             # vitest run (src/**/*.test.ts)
pnpm lint             # eslint .
pnpm typecheck        # tsc -b
pnpm build            # tsc -b && vite build -> dist/
pnpm format           # prettier --write "**/*.{ts,tsx}"
pnpm preview:worker   # build + wrangler dev
pnpm run deploy       # build + wrangler deploy (bare `pnpm deploy` is a pnpm built-in)
```

## Layout

```
src/domain/          pure logic, no React, no DOM: csv.ts, import.ts, prices.ts, portfolio.ts, decimal.ts, types.ts
src/mocks/           MSW backend: handlers.ts (routes), db.ts (state + localStorage), browser.ts (worker)
src/api/client.ts    typed fetch client, ApiRequestError
src/hooks/           usePortfolio (load, import, reset)
src/components/app/  app components
src/components/ui/   shadcn/ui components (generated)
src/lib/format.ts    display formatting (rounding for display lives here only)
problems/            read-only source material
public/mockServiceWorker.js   MSW worker, must stay in dist
```

Path alias: `@/` maps to `src/`.

## Conventions

- Formatting is Prettier: no semicolons, double quotes, 2 spaces, LF, `trailingComma: es5`, print width 80. Run `pnpm format` before committing TypeScript changes.
- Money, quantities, prices, fees and percentages are decimal strings (`DecimalString`). Never use a JS `number` for them. The only allowed conversion is the final chart or format step (`toChartNumber`, `formatCompactUsd` in `src/lib/format.ts`).
- All money math goes through `Decimal` from `@/domain/decimal` (isolated clone: precision 40, `ROUND_HALF_UP`). Never import `decimal.js` directly in other modules and never change its global config.
- Calculation lives only in `src/domain`. The UI never recomputes totals, P&L, averages or allocation; it renders values from `PortfolioResponse`. If a screen needs a new number, add it to the domain and the API contract (`src/domain/types.ts`), with a test.
- Typed contracts: shared types live in `src/domain/types.ts` and are used by domain, mocks and UI.
- Round only for display, in `src/lib/format.ts`. Never round stored or transmitted values (the 30 dp rounding of cost removed on a partial SELL in `portfolio.ts` is part of the specified calculation).
- The UI talks to the backend only through `src/api/client.ts` and `usePortfolio`. Components do not call `fetch`.
- `src/domain` must not import from `src/mocks`, `src/api`, `src/hooks` or `src/components`.

## shadcn/ui rules

- Use components from `src/components/ui`. Do not hand-roll replacements for a button, dialog, table, alert, field, etc.
- Add a missing component with `npx shadcn@latest add <name>` (config in `components.json`). Do not paste component code by hand. Use pnpm for every other install.
- Use semantic color tokens (`bg-background`, `text-muted-foreground`, `text-gain`, `text-loss`, `border-border`, `var(--chart-1)`). No raw palette classes or hex colors.
- Use `gap-*` with flex or grid for spacing. Do not use `space-x-*` or `space-y-*`.
- Icons inside buttons carry `data-icon` (`inline-start` or `inline-end`) and no sizing classes.
- Every `Dialog` has a `DialogTitle` (and a `DialogDescription`).
- Gain and loss must never rely on color alone: use `PnlValue` (icon, sign and a screen-reader word). Charts need a text alternative.

## Testing policy

- Unit tests (vitest) gate the domain layer (`src/domain/portfolio.test.ts`, `src/domain/import.test.ts`). Environment is `node`; there are no component tests.
- Playwright E2E (`e2e/*.spec.ts`, `pnpm test:e2e`) gate the MSW backend and UI states: atomic import, API status codes, storage fallback, loading/error/empty/missing-price/error-boundary states. Failures are forced only through `window.__e2e.simulate(...)` (exists only with `vite --mode e2e`); `page.route` cannot mock the MSW service worker. See [docs/testing.md](docs/testing.md).
- Change calculation or validation code only together with its tests. Keep the golden numbers in `src/domain/portfolio.test.ts` (sample data, 6 dp) in sync with [docs/calculation.md](docs/calculation.md). Do not edit an expected number to make a test pass without understanding why it changed.
- Run `pnpm test`, `pnpm lint` and `pnpm build` before finishing a change.

## Deploy rules

- Deploy target is a Cloudflare Worker with static assets: `wrangler.jsonc` sets `assets.directory` to `./dist` and `assets.not_found_handling` to `single-page-application`. There is no Worker script.
- Deploy with `pnpm run deploy`. Do not use Cloudflare Pages. Do not add a `main` Worker script unless asked.
- Never commit credentials. No `.env` files, tokens or account IDs beyond what is already in `wrangler.jsonc`. The app has no environment variables.
- `public/mockServiceWorker.js` must be in `dist` (Vite copies `public/`). The production app depends on it. Do not delete it and do not exclude it from the build.

## Commits

Conventional commits, subject line only, lowercase, no body, no co-author trailer. Examples: `feat: add import dialog`, `fix: keep average cost after partial sell`, `docs: add deployment guide`.

## `problems/`

`problems/` (assessment PDF, `trades.csv`, `prices.csv`) is read-only source material. Do not edit it. The app bundles the two CSV files at build time (`?raw`), and the golden numbers in the tests derive from them.
