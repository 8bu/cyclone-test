import { parseCsv } from "@/domain/csv"
import { Decimal } from "@/domain/decimal"
import { normalizeTimestamp } from "@/domain/import"
import { SYMBOLS, type AssetSymbol, type PriceSnapshot } from "@/domain/types"

const PRICE_COLUMNS = ["as_of", "symbol", "price_usd"] as const
const DECIMAL_RE = /^\d+(\.\d+)?$/

/** Parses prices.csv. Throws an Error with a clear message when the file is invalid. */
export function parsePricesCsv(text: string): PriceSnapshot {
  const records = parseCsv(text)
  if (records.length === 0) {
    throw new Error(`prices.csv is empty. Expected a header row with columns: ${PRICE_COLUMNS.join(", ")}.`)
  }

  const header = records[0].cells.map((cell) => cell.trim())
  for (const column of PRICE_COLUMNS) {
    if (!header.includes(column)) {
      throw new Error(`prices.csv header is missing required column "${column}".`)
    }
  }
  const asOfIndex = header.indexOf("as_of")
  const symbolIndex = header.indexOf("symbol")
  const priceIndex = header.indexOf("price_usd")

  const prices: Partial<Record<AssetSymbol, string>> = {}
  const symbolLines = new Map<string, number>()
  let latest: string | null = null

  for (const { line, cells } of records.slice(1)) {
    if (cells.length !== header.length) {
      throw new Error(`prices.csv line ${line}: expected ${header.length} columns but found ${cells.length}.`)
    }
    const asOf = normalizeTimestamp(cells[asOfIndex].trim())
    if (asOf === null) {
      throw new Error(
        `prices.csv line ${line}: as_of "${cells[asOfIndex].trim()}" must be a valid ISO-8601 date-time with a timezone.`
      )
    }
    const symbol = cells[symbolIndex].trim()
    if (!(SYMBOLS as readonly string[]).includes(symbol)) {
      throw new Error(`prices.csv line ${line}: symbol "${symbol}" is not supported. Use one of: ${SYMBOLS.join(", ")}.`)
    }
    const previous = symbolLines.get(symbol)
    if (previous !== undefined) {
      throw new Error(`prices.csv line ${line}: symbol "${symbol}" already has a price on line ${previous}.`)
    }
    symbolLines.set(symbol, line)
    const price = cells[priceIndex].trim()
    if (!DECIMAL_RE.test(price) || new Decimal(price).lte(0)) {
      throw new Error(`prices.csv line ${line}: price_usd "${price}" for ${symbol} must be a number greater than 0.`)
    }
    prices[symbol as AssetSymbol] = price
    if (latest === null || asOf > latest) latest = asOf
  }

  if (latest === null) {
    throw new Error("prices.csv has no price rows.")
  }
  return { asOf: latest, prices }
}
