/**
 * Shared data contracts. Used by the domain logic, the MSW backend and the UI.
 *
 * Money and quantities cross every boundary as DECIMAL STRINGS (e.g. "0.03141403").
 * Never use JS `number` for money. Only the UI formatting layer converts for display.
 */

export const EXCHANGES = ["Binance", "Coinbase"] as const
export const SYMBOLS = ["BTC", "ETH", "SOL", "CKB", "DOGE"] as const
export const SIDES = ["BUY", "SELL"] as const

export type Exchange = (typeof EXCHANGES)[number]
export type AssetSymbol = (typeof SYMBOLS)[number]
export type Side = (typeof SIDES)[number]

/** A decimal number as a string, e.g. "105507.74". */
export type DecimalString = string

/** The CSV columns required in trades.csv, in the order of the spec. */
export const TRADE_COLUMNS = [
  "trade_id",
  "timestamp",
  "exchange",
  "symbol",
  "side",
  "quantity",
  "price_usd",
  "fee_usd",
] as const

export interface Trade {
  tradeId: string
  /** Canonical UTC ISO-8601 string, e.g. "2025-10-01T09:00:00.000Z". */
  timestamp: string
  exchange: Exchange
  symbol: AssetSymbol
  side: Side
  quantity: DecimalString
  priceUsd: DecimalString
  feeUsd: DecimalString
  /** quantity x priceUsd, exact. */
  grossValueUsd: DecimalString
}

/** One problem found while importing a CSV. `row` is the 1-based CSV line (header = 1). */
export interface ImportIssue {
  row: number | null
  tradeId: string | null
  field: string | null
  code: ImportIssueCode
  /** Human-readable and actionable. */
  message: string
}

export type ImportIssueCode =
  | "EMPTY_FILE"
  | "MISSING_COLUMN"
  | "MALFORMED_ROW"
  | "DUPLICATE_TRADE_ID"
  | "INVALID_TIMESTAMP"
  | "UNSUPPORTED_EXCHANGE"
  | "UNSUPPORTED_SYMBOL"
  | "UNSUPPORTED_SIDE"
  | "INVALID_QUANTITY"
  | "INVALID_PRICE"
  | "INVALID_FEE"
  | "SELL_EXCEEDS_HOLDINGS"

export type ImportResult =
  | { ok: true; trades: Trade[] }
  | { ok: false; issues: ImportIssue[] }

/** prices.csv snapshot. A symbol may be missing; the UI must handle that. */
export interface PriceSnapshot {
  /** UTC ISO-8601 time the portfolio is valued at. */
  asOf: string
  prices: Partial<Record<AssetSymbol, DecimalString>>
}

/** Per-trade effect on the running position of its asset (answers "which trades produced the P&L"). */
export interface TradeEffect {
  tradeId: string
  quantityAfter: DecimalString
  costBasisAfter: DecimalString
  avgCostAfter: DecimalString
  /** Only for SELL. null for BUY. */
  realizedPnl: DecimalString | null
}

export interface Holding {
  symbol: AssetSymbol
  quantity: DecimalString
  /** Weighted-average cost per unit. "0" when quantity is 0. */
  avgCost: DecimalString
  costBasis: DecimalString
  /** null when no price exists for this symbol. */
  currentPrice: DecimalString | null
  currentValue: DecimalString | null
  realizedPnl: DecimalString
  unrealizedPnl: DecimalString | null
  totalPnl: DecimalString | null
  /** unrealizedPnl / costBasis as a fraction (0.12 = 12%). null if costBasis is 0 or price is missing. */
  unrealizedPnlPct: DecimalString | null
  /** currentValue / portfolio value as a fraction. null if value is missing or portfolio value is 0. */
  allocation: DecimalString | null
  totalFees: DecimalString
  tradeCount: number
}

export interface PortfolioSummary {
  /** Sum of currentValue of holdings that have a price. */
  portfolioValue: DecimalString
  /** Sum of costBasis of ALL holdings (also unpriced ones). */
  costBasis: DecimalString
  realizedPnl: DecimalString
  /** Sum over priced holdings only. */
  unrealizedPnl: DecimalString
  totalPnl: DecimalString
  totalFees: DecimalString
  tradeCount: number
  /** Symbols held (quantity > 0) that have no price. When non-empty, the summary is incomplete. */
  missingPrices: AssetSymbol[]
  /** unrealizedPnl / costBasis of priced holdings; null if that base is 0. */
  unrealizedPnlPct: DecimalString | null
}

export interface Portfolio {
  asOf: string | null
  summary: PortfolioSummary
  /** One row per asset with quantity > 0 or a non-zero realizedPnl (closed assets stay visible). Sorted by currentValue desc (null last), then symbol. */
  holdings: Holding[]
  /** Keyed by tradeId. */
  effects: Record<string, TradeEffect>
}

/** Response of GET /api/portfolio. One payload = one consistent view. */
export interface PortfolioResponse {
  trades: Trade[]
  prices: PriceSnapshot | null
  portfolio: Portfolio
  /** "sample" = bundled trades.csv, "imported" = user upload. */
  source: "sample" | "imported"
}

/** Error body for non-2xx API responses. */
export interface ApiError {
  error: string
  issues?: ImportIssue[]
}
