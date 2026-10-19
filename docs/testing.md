# Testing

Two layers. Both are small on purpose: they gate what can silently break correctness.

| Layer | Command | Where | What it gates |
|---|---|---|---|
| Unit (vitest, node) | `pnpm test` | `src/domain/*.test.ts` | Cost-basis maths, rounding, CSV parsing and validation, golden sample numbers (see [calculation.md](calculation.md)) |
| E2E (Playwright, Chromium) | `pnpm test:e2e` | `e2e/*.spec.ts` | MSW backend behavior and UI states in a real browser |

First run of the E2E suite: `pnpm test:e2e:install` (downloads Chromium). `pnpm test:e2e` starts its own Vite server on port 4173 in `e2e` mode (`vite --mode e2e`); with `CI` unset it reuses a server that is already running on that port.

## How E2E works with MSW

The backend is MSW running in the browser as a service worker. Playwright's `page.route` cannot intercept requests that the service worker answers, so the suite uses the real handlers:

- Requests to the API are made with `page.evaluate(() => fetch(...))` from the app origin, or through the UI.
- Failures are forced with `window.__e2e.simulate(name)` / `window.__e2e.clear()`. These exist only when the app runs with `--mode e2e` (`src/mocks/e2e.ts`, loaded by a dynamic import in `src/main.tsx`). A normal `pnpm build` contains no `__e2e` code.
- `/?e2e=<scenario>` installs a scenario before the first fetch, which is needed to test first-load states.
- Scenarios: `portfolio-500` and `reset-500` use the real `guarded` wrapper from `src/mocks/handlers.ts`, so the generic 500 body is tested, not a copy of it. `portfolio-network-error`, `portfolio-slow`, `portfolio-missing-prices` (real `computePortfolio` without a BTC price) and `portfolio-corrupt-payload`.
- Each test gets a fresh browser context, so `localStorage` starts empty.

## What the E2E suite covers

| File | Behaviors |
|---|---|
| `import-atomicity.spec.ts` | A failed import (dialog) shows all problems and leaves the dashboard, `GET /api/portfolio` and `localStorage` unchanged. A SELL dated before its BUY is rejected. A bad row hides the SELL-versus-holdings check (known limitation). A valid import persists and survives a reload. Reset restores the 200 sample trades and clears storage. A failed import after a good one keeps the imported data. |
| `api-responses.spec.ts` | 413 above 2 MB (exactly 2 MB is parsed), 422 body shape with row/code/message, 404, 500 without a stack, `GET /api/trades.csv` headers and body. |
| `storage-fallback.spec.ts` | Corrupt, incomplete or invalid stored data falls back to the sample. Unreadable/unwritable storage still lets the app boot and import in memory. |
| `ui-states.spec.ts` | Loading skeleton, API error with Retry (500 and network error) and recovery, header-only import (empty state), nothing held (empty holdings and charts), missing price (warning, `No price`, totals exclude the asset), error boundary, failed reset keeps data. |

## Known gaps

- A blanket `Storage` failure is not tested: `ThemeProvider` reads `localStorage` without a guard, so the storage-unavailable test breaks only the dataset key.
- No visual or accessibility-tree snapshot tests, and no cross-browser runs (Chromium only).
- A failed refetch while data is already shown has no UI trigger, so it is not tested.
