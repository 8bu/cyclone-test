# AI workflow

This file records real events from the build session. It was drafted by the coding agent from the session log, not from memory of a human. The owner must review it, correct it, and be able to explain every item.

## Tools and models

- Orchestrator: an AI coding agent (omp harness) running `anthropic/claude-sonnet-5-5`. It planned, ran commands, ran the quality gates, and reviewed output.
- Sub-agents: general-purpose `task` agents of the same harness (`DomainCore`, `MswBackend`, `UiDashboard`, `DocsWriter`). The exact model of each sub-agent was not recorded.
- Browser: BrowserOS neo, driven by the orchestrator, to read the Notion page and to test the app.
- Who wrote the code: the sub-agents wrote almost all of `src/` (domain, MSW backend, UI, docs). The orchestrator wrote the shared contract `src/domain/types.ts`, the config files (`vite.config.ts`, `wrangler.jsonc`), and small fixes. The human gave the task, answered the design questions, and set the constraints.

Commits are linked by hash.

## 1. Requirement analysis: reading a page that scripts render

- **Goal and context.** The task came as a Notion link. The page lists a PDF spec and two CSV files.
- **Prompt (excerpt).** "Read this https://nxio.notion.site/... Download all files from this site. If u can't access the site, just use BOS."
- **Agent response.** A plain HTTP read returned only page metadata (Notion renders with JavaScript). The agent then used the BrowserOS browser: it read the page text and found three attachments. Clicking a file opened a preview. The agent listed the browser's network requests and found a signed URL for the PDF and `output=source` preview URLs for the CSV files. It downloaded all three with `curl` into `problems/`.
- **Review.** File sizes match the page (PDF 13.8 KiB, `prices.csv` 195 B, `trades.csv` 13.8 KiB). `file` reports a 5-page PDF. `trades.csv` has 201 lines (header + 200 trades). A Python check showed 40 trades for each of the 5 symbols, 100 for each exchange, 128 BUY and 72 SELL, unique IDs, and sorted timestamps.
- **Outcome.** Accepted. The first try, a direct `download` click, failed with a "covered by span" error because a preview overlay had opened; the agent switched to the network-URL route instead of retrying the click.
- **Link.** Commit `8691cb3`.

## 2. Planning: asking instead of assuming

- **Goal and context.** The spec says to process trades "for each asset in the calculation scope", but also asks for one holdings row per asset. Two exchanges trade the same assets.
- **Prompt.** The user said: "If u have any fog, dont assume. Invoke the ask tool and start grilling". The agent asked four questions in one batch: cost-basis pooling, the meaning of an incomplete UI instruction, how to handle `AI_WORKFLOW.md` without inventing history, and repository/deploy settings.
- **Agent response.** It offered options with trade-offs and a recommended default for each.
- **Review.** The human chose pooled cost basis per asset, confirmed shadcn/ui, chose "log honestly from this session" for this file, and approved a private GitHub repository and a Workers deploy.
- **Outcome.** Accepted as answered. The human also asked to record the pooling question for the client; it is in `QUESTIONS.md`.
- **Link.** `QUESTIONS.md`, `PROBLEM.md`.

## 3. Verification design: an independent oracle before writing code

- **Goal and context.** Tests must assert known numbers. A test that computes the expected value with the same code proves nothing.
- **Prompt (agent's own step).** Before delegating the domain slice, the agent wrote a short Python script with `decimal.Decimal` (precision 50). It re-implemented the rules from the PDF, ran them over `trades.csv`/`prices.csv`, and printed per-asset and portfolio totals.
- **Agent response.** The script produced the values later pasted into the golden test: portfolio value 60,620.89161, total fees 2,708.86, realized -5,052.962688, unrealized 651.654191.
- **Review.** The script asserts that no SELL exceeds the quantity held, and shows no equal timestamps, so tie-breaking cannot change the sample result.
- **Outcome.** The sub-agent copied these numbers into `src/domain/portfolio.test.ts` (6 decimals, per asset and total). The TypeScript implementation matched them on the first run (57 tests pass). The running app shows the same totals (`$60,620.89`, `$2,708.86`).
- **Link.** Commit `8686103`, `src/domain/portfolio.test.ts`.

## 4. Architecture and data model: contract first, then parallel work

- **Goal and context.** Three parts had to be built at the same time: calculation, mock backend, UI. They need one agreed data shape.
- **Prompt.** The agent wrote `src/domain/types.ts` itself, then briefed three sub-agents with the function signatures they could rely on (`parseTradesCsv`, `computePortfolio`, `usePortfolio`, the API client) and file ownership per agent.
- **Decisions in the contract.** All money and quantity values are decimal strings (never JS numbers). Import returns either all trades or only issues (atomic). `Portfolio` includes a per-trade effect so the UI can answer "which trades produced the P&L" without recomputing anything. The UI only formats.
- **Agent response.** Each sub-agent implemented its slice against the signatures, without the other slices existing yet.
- **Review.** The orchestrator ran `tsc`, ESLint, the tests, and a build over the combined result. The slices fit together; the failures found are in items 5 and 6.
- **Outcome.** Accepted. One deviation was recorded and kept: the domain agent rounds the cost removed on a partial SELL to 30 decimals (a full close removes the basis exactly). It did this so the sum of per-trade realized P&L equals the summary realized P&L exactly; without it they differed at the 36th decimal. 30 decimals is far below display precision, and the invariant is tested. The choice is documented in `docs/calculation.md`.
- **Link.** Commits `8686103`, `e951212`; `src/domain/types.ts`.

## 5. Debugging: gate failures sent back to the agent

- **Goal and context.** After the first integration, the orchestrator ran the gates itself instead of trusting the agents' reports ("not type-checked, not run").
- **Prompt (to the MSW agent).** "src/main.tsx(13,7): TS2353 `onUnhandledRequest` does not exist in type StartOptions (MSW v3 moved it)... `use-portfolio.ts:104` eslint `react-hooks/set-state-in-effect`... restructure so the initial load does not call setState synchronously in the effect body."
- **Agent response.** It read the MSW 3 typings. The option is now `onUnhandledFrame: "bypass"`. It rewrote the mount effect to set state only after the awaited fetch, and kept the stale-response guard.
- **Review.** Re-ran typecheck, ESLint, tests and build: all clean. The app was then opened in a real browser to confirm the service worker starts and `/api/*` is mocked.
- **Outcome.** Corrected output accepted. A second finding came later: `pnpm typecheck` ran `tsc --noEmit` against a root `tsconfig.json` with `"files": []`, so it checked nothing. The docs agent noticed it; the script was changed to `tsc -b` (commit `dce543d`) and the type check now passes for real.
- **Link.** Commits `e951212`, `dce543d`.

## 6. Rejecting and correcting AI output: UI review in a browser

- **Goal and context.** The UI agent reported its work as finished but said it had not looked at it in a browser.
- **Review.** The agent opened the app, took screenshots, and tested a bad import. Found: (a) chart colors were all grey (a scaffold default), so the donut and bars were hard to read; (b) the "Unrealized" legend entry had no swatch; (c) the allocation bar in the holdings table looked like a dot; (d) import errors repeated the row number (`Row 3 · trade_id · Row 3 (T1): ...`).
- **Prompt (excerpt).** "The chart tokens are greys... change `--chart-1..5` to five distinct, accessible hues AND ensure realized vs unrealized bars are distinguishable (hue plus pattern)." A second message listed (b), (c), (d).
- **Agent response.** It set blue/teal/amber/violet/rose tokens, made Unrealized bars hatched, replaced the legend, widened the allocation track, and showed `field` as a badge with the message only. For (c) it reported that the fill width was correct and the 48 px track was too small, so it widened the track instead of changing the logic.
- **Outcome.** The agent accepted the diagnosis for (c) after reading the code, and checked the result in the browser (charts, mobile width 360 px with no horizontal page scroll). Commit `1ac8885`.
- **Link.** Commit `1ac8885`.

## 7. Testing the import boundary

- **Goal and context.** Spec: reject a SELL that makes a short position, reject invalid or duplicate rows, and never leave a partial import.
- **Prompt (excerpt, to the domain agent).** "A SELL placed earlier in time than its matching BUY even if listed later in the file must be rejected (ordering by timestamp, not file order), and a SELL equal to the held quantity accepted... Return either all trades or only issues."
- **Agent response.** `parseTradesCsv` collects all row-level issues first and runs the holdings simulation only if rows are valid. Tests cover missing columns, duplicate IDs, bad timestamps, unsupported exchange/symbol/side, zero or negative quantity, zero price, negative fee, malformed rows, empty file, and header-only file.
- **Review.** Beyond the unit tests, the orchestrator posted CSV bodies to the running mock API in the browser: a file whose SELL comes before its BUY in time returned HTTP 422 with `SELL_EXCEEDS_HOLDINGS` and an exact message; a header-only file returned 200 with 0 trades; reset restored 200 sample trades; an unknown `/api/*` path returned 404. A pasted bad file in the dialog showed five clear errors and the dashboard did not change.
- **Outcome.** Accepted. Known limit: a row-level error hides the SELL-versus-holdings check for that file until the row errors are fixed (documented in `docs/calculation.md`).
- **Link.** Commit `8686103`, `src/domain/import.test.ts`.

## 8. Deployment and documentation

- **Goal and context.** The spec wants a public URL that works without setup. The human required Cloudflare Workers static assets in SPA mode, not Pages.
- **Prompt (excerpt).** "Make the project compatible to deploy on Cloudflare Worker static mode, SPA build (not Pages, its deprecated)."
- **Agent response.** `wrangler.jsonc` has `assets.directory: ./dist` and `not_found_handling: single-page-application` with no Worker script. The MSW service worker file is a static asset in `public/`, so it ships in `dist/`.
- **Review.** After `wrangler deploy`, the agent opened the live URL and a deep path (`/some/deep/link`) in the browser: both load the dashboard with the sample totals. A docs agent wrote the README and docs from the code; the orchestrator found two wrong statements (the `pnpm typecheck` note, and `pnpm deploy`, which is a built-in pnpm command that does not run the script) and fixed them to `pnpm run deploy`.
- **Outcome.** Accepted after edits.
- **Link.** `wrangler.jsonc`, `docs/deployment.md`.
