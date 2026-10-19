# Problem (ASD-STE100 style)

Source: `problems/assessment.pdf`. Data: `problems/trades.csv`, `problems/prices.csv`.

## Goal

Build a web app. The app shows a crypto portfolio.
The user trades 5 assets on 2 exchanges: BTC, ETH, SOL, CKB, DOGE.
The app reads a list of trades. It does not call a live exchange.

The user must see:

- What assets they hold.
- What each position is worth now.
- The average cost and the remaining cost basis.
- The profit or loss they realized (sold).
- The profit or loss they did not realize yet (still held).
- Which trades and fees caused these numbers.

## Input

- `trades.csv`: 200 BUY and SELL trades. Fields: `trade_id`, `timestamp`, `exchange`, `symbol`, `side`, `quantity`, `price_usd`, `fee_usd`.
- `prices.csv`: one current price for each asset, with the time of the price (`as_of`).

The data never makes a short position.

## Calculation rules

Use the weighted-average cost. Process the trades of each asset in time order.

- BUY: cost basis goes up by `quantity x price + fee`. The BUY fee becomes part of cost.
- SELL: `net proceeds = quantity x price - fee`. `cost removed = average cost x quantity sold`. `realized P&L = net proceeds - cost removed`. A SELL does not change the average cost.
- Full close: set quantity, cost basis, and average cost to zero.
- Now: `value = quantity x current price`. `unrealized = value - cost basis`. `total = realized + unrealized`. `allocation = asset value / portfolio value`.
- `total fees` = all BUY fees + all SELL fees.

Keep full precision. Round only for display. Write down the number type.

## Required features

1. Import and re-import of `trades.csv`. Validate: columns, unique IDs, valid timestamps, known exchange/symbol/side, quantity and price greater than zero, fee zero or more, no SELL above the quantity held. Show clear errors. A bad file must not change the app state (all or nothing).
2. Dashboard: value, cost basis, realized, unrealized, total P&L, total fees. Show the price time. Positive and negative values must differ without color alone.
3. Holdings table: one row for each asset (quantity, average cost, price, cost basis, value, realized, unrealized, total, allocation).
4. Two charts at least: allocation by value; realized and unrealized P&L by asset. They must match the table.
5. Transaction table: filter by asset, exchange, side, date range; sort by time; pagination or virtualization; all fields, gross value, fee.
6. Empty, loading, error states. Missing prices. Zero holdings.

## Technical rules

- Clear split between frontend and backend.
- Calculation code separate from UI code, and deterministic.
- Typed data contracts. No secrets in the repository.
- Responsive and accessible UI.
- Tests for: many BUYs, BUY fees in cost, partial SELL, SELL fees, full close then BUY, short-position rejection, bad or duplicate CSV rows. Tests check known numbers. One command runs them.
- Public URL. Do not add auth, blockchain, or live market data.

## Deliverables

Repository, live URL, `README.md`, `AI_WORKFLOW.md` (5-8 real examples of AI-agent work, with at least one corrected AI output).

## Grading weight

AI workflow 35%, calculation correctness 30%, architecture 15%, UX 10%, tests 5%, deploy and docs 5%.

## Project decisions

- Stack: Vite, React, TypeScript, shadcn/ui. Backend is MSW (browser mock API). Deploy: Cloudflare Workers static assets, SPA mode.
- Cost basis is pooled per asset across both exchanges (see `QUESTIONS.md`).
