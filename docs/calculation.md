# Calculation

Back to [README.md](README.md). Code: `src/domain/portfolio.ts` (calculation), `src/domain/import.ts` (validation), `src/domain/decimal.ts` (number type). Tests: `src/domain/portfolio.test.ts`, `src/domain/import.test.ts`. Run them with `pnpm test`.

Method: weighted-average cost, one pooled position per asset across both exchanges (see [QUESTIONS.md](QUESTIONS.md)).

## Numeric type and rounding

- Type: `Decimal` from `decimal.js`, one isolated clone in `src/domain/decimal.ts`: `precision: 40` significant digits, `rounding: ROUND_HALF_UP`. The global `Decimal` config is not touched.
- Inputs (`quantity`, `price_usd`, `fee_usd`) stay as the strings from the CSV. They are never parsed as JS numbers.
- Outputs are decimal strings produced with `toFixed()`, so they never use exponent notation. The golden test asserts that the serialized portfolio contains no exponent.
- Additions, subtractions and multiplications are exact up to 40 significant digits. Divisions (average cost, percentages, allocation) round half up to 40 significant digits.
- The one deliberate rounding in the calculation: on a partial SELL the cost removed is rounded to 30 decimal places (see SELL). It keeps cost basis and realized P&L sums exact in 40 digits.
- Display rounding is separate and happens only in `src/lib/format.ts` (half up): USD 2 dp, percent 2 dp, unit price 2 dp when >= 1 and up to 8 dp when < 1, quantity up to 8 dp. Stored and transmitted values are never rounded for display.

## Ordering rules

- `parseTradesCsv` sorts valid trades ascending by `timestamp` (normalized UTC ISO string). The sort is stable: trades with equal timestamps keep file order.
- `computePortfolio` sorts a copy of its input the same way (stable) and does not mutate the input. Each asset's position is updated in that order. Equal timestamps therefore resolve by file order.
- The SELL-versus-holdings validation uses the same order, per symbol, across both exchanges.

## Formulas as implemented

Per asset, state: `quantity`, `costBasis`, `realizedPnl`, `totalFees`, `tradeCount`, all starting at 0. For each trade in order, with `gross = quantity x price_usd` and `fee = fee_usd`:

### BUY

```
quantity  += trade.quantity
costBasis += gross + fee
```

The BUY fee is capitalized into cost.

### SELL

```
proceeds     = gross - fee
costRemoved  = costBasis x trade.quantity / quantity        (rounded to 30 dp)
realized     = proceeds - costRemoved
realizedPnl += realized
quantity    -= trade.quantity
costBasis   -= costRemoved
```

`costRemoved` equals `averageCost x quantity sold`, where `averageCost = costBasis / quantity` before the sale. The average cost is unchanged by a SELL (costBasis and quantity shrink in the same proportion), apart from the 30 dp rounding.

A SELL for more than the held quantity makes `computePortfolio` throw (defensive; import validation rejects such files first).

### Full close

When the SELL quantity equals the held quantity: `costRemoved = costBasis` exactly (no division, no rounding), and the position ends with `quantity = 0` and `costBasis = 0`. A later BUY starts from zero, so the old average cost does not leak into the new position. The average cost of a position with quantity 0 is reported as `"0"`.

### Fees

```
totalFees (per asset) = sum of fee of every BUY and SELL of that asset
totalFees (summary)   = sum over assets
```

BUY fees are inside cost basis and also counted in `totalFees`. SELL fees reduce proceeds and are counted in `totalFees`. `totalFees` is informational: it is not subtracted again anywhere.

### Valuation

For each asset with a price `p` in the snapshot:

```
averageCost    = costBasis / quantity            ("0" if quantity = 0)
currentValue   = quantity x p
unrealizedPnl  = currentValue - costBasis
totalPnl       = realizedPnl + unrealizedPnl
unrealizedPct  = unrealizedPnl / costBasis       (fraction; null if costBasis = 0)
allocation     = currentValue / portfolioValue   (fraction; null if the asset has no price or portfolioValue = 0)
```

For an asset without a price, `currentPrice`, `currentValue`, `unrealizedPnl`, `totalPnl`, `unrealizedPnlPct` and `allocation` are `null`.

### Summary

```
portfolioValue   = sum of currentValue over priced assets
costBasis        = sum of costBasis over ALL assets (priced or not)
realizedPnl      = sum of realizedPnl over all assets
unrealizedPnl    = sum of unrealizedPnl over priced assets
totalPnl         = realizedPnl + unrealizedPnl
totalFees        = sum of totalFees over all assets
tradeCount       = number of trades
unrealizedPnlPct = unrealizedPnl / (sum of costBasis over priced assets)   (null if that base is 0)
missingPrices    = symbols with quantity > 0 and no price
asOf             = snapshot.asOf (latest as_of in prices.csv), null without a snapshot
```

Because priced and unpriced assets are treated differently, when `missingPrices` is not empty the summary is incomplete: `portfolioValue`, `unrealizedPnl` and `totalPnl` leave out those assets while `costBasis` and `realizedPnl` include them.

### Holdings rows and order

A holding row exists for each asset that has quantity > 0 or a non-zero realized P&L (a fully closed asset with realized P&L stays visible). Rows are sorted by `currentValue` descending, rows without a value last, ties by symbol.

### Per-trade effects

For every trade, `effects[tradeId]` holds `quantityAfter`, `costBasisAfter`, `avgCostAfter` (all after that trade) and `realizedPnl` (SELL only, otherwise `null`). The sum of all `realizedPnl` effects equals `summary.realizedPnl` (asserted in tests).

## Validation rules and issue codes

`parseTradesCsv(text)` is atomic: it returns either all trades or only issues. Header names are matched after trimming and may appear in any column order. Required columns: `trade_id, timestamp, exchange, symbol, side, quantity, price_usd, fee_usd`. Extra columns are allowed. Numeric fields must match `^\d+(\.\d+)?$` (plain decimals: no sign, no exponent, no thousands separator).

| Code | Raised when |
|---|---|
| `EMPTY_FILE` | The file has no non-blank line. Row is `null`. |
| `MISSING_COLUMN` | A required column is absent from the header. One issue per missing column; validation stops there. |
| `MALFORMED_ROW` | The number of cells differs from the header, or `trade_id` is empty. |
| `DUPLICATE_TRADE_ID` | A `trade_id` was already used on an earlier row (the message names that row). |
| `INVALID_TIMESTAMP` | Not an ISO-8601 date-time with a timezone (`Z` or `+hh:mm`), or not a real instant (for example month 13, 31 February, hour 24). Seconds and fraction are optional; the value is normalized to UTC. |
| `UNSUPPORTED_EXCHANGE` | Not one of `Binance`, `Coinbase`. |
| `UNSUPPORTED_SYMBOL` | Not one of `BTC`, `ETH`, `SOL`, `CKB`, `DOGE`. |
| `UNSUPPORTED_SIDE` | Not `BUY` or `SELL`. |
| `INVALID_QUANTITY` | Not a plain decimal greater than 0. |
| `INVALID_PRICE` | `price_usd` is not a plain decimal greater than 0. |
| `INVALID_FEE` | `fee_usd` is not a plain decimal of 0 or more. A zero fee is valid. |
| `SELL_EXCEEDS_HOLDINGS` | In timestamp order, a SELL quantity is greater than the quantity of that symbol held at that point (exact decimal compare, both exchanges pooled). Reported only when no row-level issue exists. |

Other rules:

- Row-level checks run for every row and all issues are collected (at most 200 are kept). Only if there are none does the holdings replay run.
- The first issue of a bad row does not hide the others on the same row.
- `row` in an issue is the 1-based CSV line, header = line 1. Quoted fields with embedded newlines count their newlines; blank lines are skipped but counted.
- A header-only file is valid and yields zero trades.
- `parsePricesCsv` (the bundled `prices.csv`) requires columns `as_of, symbol, price_usd`, a valid timestamp, a known symbol, at most one row per symbol, and a price greater than 0. It throws on any violation. `asOf` is the latest `as_of`.

## Worked example

From `src/domain/portfolio.test.ts` (tests (b) and (c)). All trades are BTC on different days:

| Trade | Exchange | Side | Quantity | Price | Fee |
|---|---|---|---|---|---|
| T1 | Binance | BUY | 1 | 100 | 1 |
| T2 | Coinbase | BUY | 1 | 200 | 2 |
| T3 | Binance | SELL | 0.5 | 300 | 1 |

1. T1: cost = 1 x 100 + 1 = 101; quantity 1.
2. T2: cost = 101 + (1 x 200 + 2) = 303; quantity 2; average cost = 303 / 2 = 151.5.
3. T3: net proceeds = 0.5 x 300 - 1 = 149. Cost removed = 303 x 0.5 / 2 = 75.75. Realized = 149 - 75.75 = 73.25.
4. After T3: quantity 1.5; cost = 303 - 75.75 = 227.25; average cost = 227.25 / 1.5 = 151.5 (unchanged). Total fees = 1 + 2 + 1 = 4.

Full close then BUY (test (d)): BUY 3 @ 100.1 fee 0.3 gives cost 300.6, average 100.2. SELL 1 @ 120 (fee 0): removed 100.2, realized 19.8; quantity 2, cost 200.4. SELL 2 @ 130 fee 0.7: net 259.3, removed 200.4 (full close, exact), realized 58.9; quantity 0, cost exactly 0; total realized 78.7. A later BUY 1 @ 50 fee 1 gives cost 51 and average cost 51.

## Golden sample results

Input: `problems/trades.csv` (200 trades) and `problems/prices.csv` (as of `2026-03-31T23:59:59Z`). Expected values come from an independent Python `Decimal` reference and are asserted in `src/domain/portfolio.test.ts` at 6 dp (quantities at 8 dp).

Summary:

| Metric | Value (USD) |
|---|---|
| Portfolio value | 60620.891610 |
| Cost basis | 59969.237419 |
| Realized P&L | -5052.962688 |
| Unrealized P&L | 651.654191 |
| Total P&L | -4401.308497 |
| Total fees | 2708.860000 |
| Trade count | 200 |
| Missing prices | none |

Per asset:

| Symbol | Quantity | Cost basis | Current value | Realized P&L | Unrealized P&L | Total fees |
|---|---|---|---|---|---|---|
| BTC | 0.07742920 | 9114.338240 | 8633.355800 | -463.745975 | -480.982440 | 486.420000 |
| CKB | 1947047 | 13382.759245 | 13921.386050 | 1499.627490 | 538.626805 | 525.210000 |
| DOGE | 63970.78 | 14390.532135 | 15480.928760 | -2695.484056 | 1090.396625 | 648.580000 |
| ETH | 2.846898 | 11648.427223 | 11458.764450 | -984.425549 | -189.662773 | 529.660000 |
| SOL | 53.3643 | 11433.180577 | 11126.456550 | -2408.934598 | -306.724027 | 518.990000 |

BTC average cost: 117711.899901. Allocation across the five assets sums to 1 (checked to 20 dp), and holdings are sorted by current value descending.

If you change calculation or validation code, keep these numbers and the test file in sync.
