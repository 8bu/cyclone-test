import { parseCsv } from "@/domain/csv"
import { Decimal } from "@/domain/decimal"
import {
  EXCHANGES,
  SIDES,
  SYMBOLS,
  TRADE_COLUMNS,
  type AssetSymbol,
  type Exchange,
  type ImportIssue,
  type ImportIssueCode,
  type ImportResult,
  type Side,
  type Trade,
} from "@/domain/types"

const MAX_ISSUES = 200

const TIMESTAMP_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(?:(Z)|([+-])(\d{2}):(\d{2}))$/
const DECIMAL_RE = /^\d+(\.\d+)?$/

/**
 * Parses an ISO-8601 date-time that carries a timezone (Z or +hh:mm) and
 * returns it as a canonical UTC string, or null when it is not a real instant.
 */
export function normalizeTimestamp(value: string): string | null {
  const m = TIMESTAMP_RE.exec(value)
  if (!m) return null
  const [year, month, day, hour, minute] = [m[1], m[2], m[3], m[4], m[5]].map(Number)
  const second = m[6] ? Number(m[6]) : 0
  const millis = m[7] ? Number(m[7].slice(0, 3).padEnd(3, "0")) : 0
  if (month < 1 || month > 12 || day < 1) return null
  if (hour > 23 || minute > 59 || second > 59) return null

  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  date.setUTCHours(hour, minute, second, millis)

  if (m[9]) {
    const offsetHours = Number(m[10])
    const offsetMinutes = Number(m[11])
    if (offsetHours > 23 || offsetMinutes > 59) return null
    const offset = (offsetHours * 60 + offsetMinutes) * (m[9] === "+" ? 1 : -1)
    date.setTime(date.getTime() - offset * 60_000)
  }
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function oneOf<T extends string>(list: readonly T[], value: string): value is T {
  return (list as readonly string[]).includes(value)
}

function quote(value: string): string {
  return JSON.stringify(value)
}

/**
 * Parses and validates trades.csv. Atomic: returns either every trade
 * (sorted ascending by timestamp, stable) or only the issues found.
 */
export function parseTradesCsv(text: string): ImportResult {
  const issues: ImportIssue[] = []
  const report = (
    row: number | null,
    tradeId: string | null,
    field: string | null,
    code: ImportIssueCode,
    message: string
  ) => {
    if (issues.length < MAX_ISSUES) issues.push({ row, tradeId, field, code, message })
  }

  const records = parseCsv(text)
  if (records.length === 0) {
    report(
      null,
      null,
      null,
      "EMPTY_FILE",
      `The file is empty. Expected a header row with columns: ${TRADE_COLUMNS.join(", ")}.`
    )
    return { ok: false, issues }
  }

  const header = records[0].cells.map((cell) => cell.trim())
  const columnIndex = new Map<string, number>()
  header.forEach((name, i) => {
    if (!columnIndex.has(name)) columnIndex.set(name, i)
  })

  for (const column of TRADE_COLUMNS) {
    if (!columnIndex.has(column)) {
      report(
        records[0].line,
        null,
        column,
        "MISSING_COLUMN",
        `Header is missing required column "${column}". Expected columns: ${TRADE_COLUMNS.join(", ")}.`
      )
    }
  }
  if (issues.length > 0) return { ok: false, issues }

  type Parsed = Trade & { line: number }
  const parsed: Parsed[] = []
  const seenIds = new Map<string, number>()

  for (const record of records.slice(1)) {
    const { line, cells } = record
    const get = (column: (typeof TRADE_COLUMNS)[number]) =>
      (cells[columnIndex.get(column)!] ?? "").trim()

    if (cells.length !== header.length) {
      report(
        line,
        get("trade_id") || null,
        null,
        "MALFORMED_ROW",
        `Row ${line}: expected ${header.length} columns but found ${cells.length}.`
      )
      continue
    }

    const tradeId = get("trade_id")
    const label = tradeId ? `Row ${line} (${tradeId})` : `Row ${line}`
    const id = tradeId || null
    let valid = true
    const fail = (field: string, code: ImportIssueCode, message: string) => {
      valid = false
      report(line, id, field, code, `${label}: ${message}`)
    }

    if (!tradeId) {
      fail("trade_id", "MALFORMED_ROW", "trade_id must not be empty.")
    } else {
      const first = seenIds.get(tradeId)
      if (first !== undefined) {
        fail(
          "trade_id",
          "DUPLICATE_TRADE_ID",
          `trade_id "${tradeId}" is already used on row ${first}. Every trade_id must be unique.`
        )
      } else {
        seenIds.set(tradeId, line)
      }
    }

    const rawTimestamp = get("timestamp")
    const timestamp = normalizeTimestamp(rawTimestamp)
    if (timestamp === null) {
      fail(
        "timestamp",
        "INVALID_TIMESTAMP",
        `timestamp ${quote(rawTimestamp)} must be a valid ISO-8601 date-time with a timezone, e.g. 2025-10-01T09:00:00Z.`
      )
    }

    const exchange = get("exchange")
    if (!oneOf<Exchange>(EXCHANGES, exchange)) {
      fail(
        "exchange",
        "UNSUPPORTED_EXCHANGE",
        `exchange ${quote(exchange)} is not supported. Use one of: ${EXCHANGES.join(", ")}.`
      )
    }

    const symbol = get("symbol")
    if (!oneOf<AssetSymbol>(SYMBOLS, symbol)) {
      fail(
        "symbol",
        "UNSUPPORTED_SYMBOL",
        `symbol ${quote(symbol)} is not supported. Use one of: ${SYMBOLS.join(", ")}.`
      )
    }

    const side = get("side")
    if (!oneOf<Side>(SIDES, side)) {
      fail("side", "UNSUPPORTED_SIDE", `side ${quote(side)} must be BUY or SELL.`)
    }

    const quantity = get("quantity")
    if (!DECIMAL_RE.test(quantity) || new Decimal(quantity).lte(0)) {
      fail("quantity", "INVALID_QUANTITY", `quantity ${quote(quantity)} must be a number greater than 0.`)
    }

    const price = get("price_usd")
    if (!DECIMAL_RE.test(price) || new Decimal(price).lte(0)) {
      fail("price_usd", "INVALID_PRICE", `price_usd ${quote(price)} must be a number greater than 0.`)
    }

    const fee = get("fee_usd")
    if (!DECIMAL_RE.test(fee)) {
      fail("fee_usd", "INVALID_FEE", `fee_usd ${quote(fee)} must be a number of 0 or more.`)
    }

    if (!valid) continue
    parsed.push({
      line,
      tradeId,
      timestamp: timestamp!,
      exchange: exchange as Exchange,
      symbol: symbol as AssetSymbol,
      side: side as Side,
      quantity,
      priceUsd: price,
      feeUsd: fee,
      grossValueUsd: new Decimal(quantity).times(price).toFixed(),
    })
  }

  if (issues.length > 0) return { ok: false, issues }

  // Chronological order (stable: ties keep file order), then replay holdings per symbol.
  const sorted = [...parsed].sort((a, b) =>
    a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0
  )
  const held = new Map<AssetSymbol, InstanceType<typeof Decimal>>()
  for (const trade of sorted) {
    const available = held.get(trade.symbol) ?? new Decimal(0)
    const quantity = new Decimal(trade.quantity)
    if (trade.side === "BUY") {
      held.set(trade.symbol, available.plus(quantity))
      continue
    }
    if (quantity.gt(available)) {
      report(
        trade.line,
        trade.tradeId,
        "quantity",
        "SELL_EXCEEDS_HOLDINGS",
        `Row ${trade.line} (${trade.tradeId}): cannot SELL ${trade.quantity} ${trade.symbol} at ${trade.timestamp}; only ${available.toFixed()} ${trade.symbol} held at that point (trades are ordered by timestamp, across all exchanges).`
      )
      continue
    }
    held.set(trade.symbol, available.minus(quantity))
  }
  if (issues.length > 0) return { ok: false, issues }

  return {
    ok: true,
    trades: sorted.map((entry) => ({
      tradeId: entry.tradeId,
      timestamp: entry.timestamp,
      exchange: entry.exchange,
      symbol: entry.symbol,
      side: entry.side,
      quantity: entry.quantity,
      priceUsd: entry.priceUsd,
      feeUsd: entry.feeUsd,
      grossValueUsd: entry.grossValueUsd,
    })),
  }
}
