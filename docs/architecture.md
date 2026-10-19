# Architecture

Back to [README.md](README.md). Related: [calculation.md](calculation.md), [deployment.md](deployment.md).

## Layers

```
UI components  ->  usePortfolio hook  ->  API client  ->  [fetch /api/*]  ->  MSW handlers  ->  mock db  ->  domain
src/components     src/hooks              src/api          network boundary     src/mocks          src/mocks   src/domain
```

The frontend/backend split is real at the `fetch` boundary: the UI only knows URLs and the JSON contract in `src/domain/types.ts`. The backend is simulated by MSW in the browser (see "Why MSW works in production").

### Domain (`src/domain`)

Pure, deterministic TypeScript. No React, no DOM, no I/O.

| Module | Responsibility |
|---|---|
| `decimal.ts` | Isolated `Decimal` clone: precision 40, `ROUND_HALF_UP`. The only module that imports `decimal.js`. |
| `types.ts` | Shared contracts: `Trade`, `ImportIssue`, `ImportIssueCode`, `PriceSnapshot`, `Holding`, `PortfolioSummary`, `Portfolio`, `PortfolioResponse`, `ApiError`, and the constants `EXCHANGES`, `SYMBOLS`, `SIDES`, `TRADE_COLUMNS`. |
| `csv.ts` | `parseCsv`: RFC 4180 parser (quoted fields, `""` escapes, embedded newlines, CRLF/LF/CR, leading BOM). Blank lines are skipped but still counted in line numbers. |
| `import.ts` | `parseTradesCsv` (atomic validation, see [calculation.md](calculation.md)) and `normalizeTimestamp`. |
| `prices.ts` | `parsePricesCsv`: reads `as_of,symbol,price_usd`; throws an `Error` with a clear message on invalid input. `asOf` is the latest `as_of` in the file. |
| `portfolio.ts` | `computePortfolio(trades, prices)`: positions, per-trade effects, holdings, summary. |

### MSW backend (`src/mocks`)

| Module | Responsibility |
|---|---|
| `browser.ts` | `setupWorker(...handlers)`. |
| `handlers.ts` | Route handlers. Adds 250 ms latency to each request, maps unexpected throws to a generic `500`, enforces the 2 MB import cap, and answers `404` for unknown `/api/*` paths. |
| `db.ts` | In-memory state `{ source, csv, trades }`. Loads the persisted import from `localStorage` (key `cyclone.trades.v1`, value `{ "csv": "<text>" }`) or falls back to the bundled sample (`problems/trades.csv`). Prices always come from the bundled `problems/prices.csv`. Both are imported with Vite `?raw`. |

`db.ts` persists the raw CSV text, not the parsed trades. On startup the text is parsed again; if the stored value is missing, unreadable or no longer valid, the app falls back to the sample. `localStorage` failures (unavailable, quota) are swallowed: the dataset then lives in memory for the session.

### API client and hook

- `src/api/client.ts`: `fetchPortfolio`, `importTrades`, `resetSample`. Every call returns a `PortfolioResponse` or throws `ApiRequestError` (`status`, `message`, `issues`). `status` is `0` when the request could not complete or the body was unreadable. `SAMPLE_CSV_URL` (`/api/trades.csv`) is used as a plain download link.
- `src/hooks/use-portfolio.ts`: `usePortfolio()` returns `{ status, data, error, busy, refetch, importCsv, reset }`. A generation counter makes every write operation supersede older in-flight results, so a slow response never overwrites newer data.

### UI (`src/App.tsx`, `src/components/app`)

`App` switches between loading, error, empty and data views. Components render `PortfolioResponse` fields and format them with `src/lib/format.ts`. They do not compute totals, averages, P&L or allocation. The transactions table filters (asset, exchange, side, UTC date range, trade id search), sorts by time (ties by trade id) and paginates (25 per page) over the trades array; its per-trade realized P&L and average cost after the trade come from `portfolio.effects`. The only sums it computes are the totals of gross value and fees for the filtered rows, in `Decimal`.

## Data flow

### Load

1. `main.tsx` awaits `worker.start({ serviceWorker: { url: "/mockServiceWorker.js" }, onUnhandledFrame: "bypass", quiet: true })`. If the worker fails to start, the error is logged and the app still renders; the UI then shows the API error state.
2. `usePortfolio` mounts and calls `GET /api/portfolio`.
3. The handler calls `db.getResponse()`, which runs `computePortfolio(state.trades, prices)` and returns `{ trades, prices, portfolio, source }`.
4. The hook commits the payload; `App` renders it.

### Import (atomic)

1. The import dialog reads the chosen file (or pasted text) in the browser and calls `importTrades(text)`: `POST /api/trades/import`, `Content-Type: text/csv`, body = raw CSV.
2. The handler rejects bodies larger than 2 MB (`413`), checking the declared `content-length` first and then the actual body size.
3. `db.importCsv` runs `parseTradesCsv` over the whole text. Only if the result is `ok` does it replace `state` and write the CSV to `localStorage`. On any issue it returns the issues and touches nothing.
4. Success: `200` with the new `PortfolioResponse`. Failure: `422` with `{ error, issues }`. The dialog stays open, lists the issues (first 50) and states that nothing was imported.

### Reset

`POST /api/trades/reset` calls `db.resetToSample()` (state back to the bundled sample, `localStorage` key removed) and returns the new `PortfolioResponse`. The header asks for confirmation first.

### Export

`GET /api/trades.csv` returns the current dataset's CSV text as `text/csv` with `Content-Disposition: attachment; filename="trades.csv"`. The header link downloads it.

## API

All responses are JSON except `GET /api/trades.csv`. Error bodies are `{ "error": string, "issues"?: ImportIssue[] }`. `PortfolioResponse` is `{ trades, prices, portfolio, source }`, with `source` either `"sample"` or `"imported"`; all numeric values are decimal strings.

| Method | Path | Request | Success | Errors |
|---|---|---|---|---|
| GET | `/api/portfolio` | none | `200` `PortfolioResponse` | `500` |
| GET | `/api/trades.csv` | none | `200` `text/csv`, current dataset | `500` |
| POST | `/api/trades/import` | `Content-Type: text/csv`, body = CSV text (max 2 MB) | `200` `PortfolioResponse` | `413` file larger than 2 MB; `422` validation failed, body has `issues` (at most 200), no data changed; `500` |
| POST | `/api/trades/reset` | none | `200` `PortfolioResponse` (sample) | `500` |
| any | `/api/*` (unmatched) | any | none | `404` `{ "error": "Not found." }` |

`500` bodies are `{ "error": "Internal error while <action>." }`; the stack stays in the console.

`ImportIssue` is `{ row, tradeId, field, code, message }` where `row` is the 1-based CSV line (header = 1) or `null`. The issue codes are listed in [calculation.md](calculation.md#validation-rules-and-issue-codes).

## Error handling and observable failure states

| Situation | Where it surfaces |
|---|---|
| Initial load fails (network error, non-2xx, unreadable body) | `ErrorState` alert with the message and a Retry button. `status` is `"error"` only while there is no data. |
| A later reset or refetch fails | Data stays on screen; a destructive alert "Something did not work" shows the message. |
| Import rejected (`422`) | Import dialog: alert with the issue count and the first 50 issues (row, field, message), "Nothing was imported". Current data unchanged. |
| Import too large (`413`) or other failure without issues | Import dialog alert with the API message. |
| No trades (header-only CSV) | `NoTradesState` with Import and Reset actions. |
| Missing price for a held symbol | `MissingPricesAlert` naming the symbols; those assets are excluded from value, unrealized, total P&L and allocation. Cells show an em dash with a screen-reader "Not available". |
| Loaded trades give no holdings and no realized result | `NoPositionsState` in the holdings table. |
| A render error in the data views | `ErrorBoundary` alert with a Reload button; it clears itself when new data arrives. |
| MSW worker fails to start | Logged; the app renders and the first API call fails into the initial-load error state. |

## Accessibility

- Gain, loss and flat are never conveyed by color alone. `PnlValue` renders an icon (up, down, minus), an explicit sign (`+`, true minus `−`) and a screen-reader word ("gain", "loss", "no change"). Values that round to zero display as flat.
- Charts have text alternatives. The allocation donut has `role="img"` with an `aria-label` listing every asset and its percentage, plus a visible legend list. The P&L bar chart has `role="img"` with an `aria-label` summarizing realized and unrealized per asset, a visible legend (the unrealized bars are hatched, not only a different color), and a screen-reader-only data table.
- Tables use captions and header scopes; the asset column is sticky on horizontal scroll.
- The page has a skip-to-content link and a focusable `main` landmark. Dialogs use Radix (focus trap, `DialogTitle`, `DialogDescription`). The scrollable import issue list is a focusable labelled region.
- Chart and table values come from the same `PortfolioResponse`, so they match.

## Why MSW works in production on Workers static assets

MSW intercepts `fetch` inside the browser through a service worker, not through a server. The built app ships `mockServiceWorker.js` (copied from `public/` into `dist/`). Cloudflare serves it as a static asset at `/mockServiceWorker.js`, with the same origin as the page, which is what service-worker registration requires. `main.tsx` registers it before rendering, so `/api/*` requests are answered in the browser and never reach Cloudflare. The assets config needs no Worker script ([deployment.md](deployment.md)). `onUnhandledFrame: "bypass"` lets every non-API request (the JS, CSS and font assets) go to the network normally.

Consequences: there is no shared server state, each browser has its own dataset, and a real backend would replace `src/mocks` without UI changes as long as it keeps the contract above.
