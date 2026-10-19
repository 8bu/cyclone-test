import sampleTradesCsv from "../../problems/trades.csv?raw"
import samplePricesCsv from "../../problems/prices.csv?raw"

import { parseTradesCsv } from "@/domain/import"
import { computePortfolio } from "@/domain/portfolio"
import { parsePricesCsv } from "@/domain/prices"
import type {
  ImportResult,
  PortfolioResponse,
  PriceSnapshot,
  Trade,
} from "@/domain/types"

/** localStorage key of an imported dataset (`{ csv }`). */
export const STORAGE_KEY = "cyclone.trades.v1"

interface DbState {
  source: "sample" | "imported"
  csv: string
  trades: Trade[]
}

/** Prices always come from the bundled prices.csv. */
const prices: PriceSnapshot = parsePricesCsv(samplePricesCsv)

function sampleState(): DbState {
  const result = parseTradesCsv(sampleTradesCsv)
  if (!result.ok) {
    throw new Error("Bundled trades.csv is invalid")
  }
  return { source: "sample", csv: sampleTradesCsv, trades: result.trades }
}

function readPersisted(): DbState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("csv" in parsed) ||
      typeof parsed.csv !== "string"
    ) {
      return null
    }
    const csv = parsed.csv
    const result = parseTradesCsv(csv)
    return result.ok ? { source: "imported", csv, trades: result.trades } : null
  } catch {
    return null
  }
}

function persist(csv: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ csv }))
  } catch {
    // Storage unavailable or full: the dataset stays in memory for this session.
  }
}

function unpersist(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage unavailable: nothing to clear.
  }
}

let state: DbState = readPersisted() ?? sampleState()

export function getResponse(): PortfolioResponse {
  return {
    trades: state.trades,
    prices,
    portfolio: computePortfolio(state.trades, prices),
    source: state.source,
  }
}

export function currentCsv(): string {
  return state.csv
}

/** Validates `text`; replaces the dataset only when it is fully valid. */
export function importCsv(text: string): ImportResult {
  const result = parseTradesCsv(text)
  if (!result.ok) return result
  state = { source: "imported", csv: text, trades: result.trades }
  persist(text)
  return result
}

export function resetToSample(): void {
  state = sampleState()
  unpersist()
}
