import { describe, expect, it } from "vitest"

import { parseCsv } from "@/domain/csv"
import { parseTradesCsv } from "@/domain/import"
import { parsePricesCsv } from "@/domain/prices"
import type { ImportIssue } from "@/domain/types"

const HEADER = "trade_id,timestamp,exchange,symbol,side,quantity,price_usd,fee_usd"

function csv(...rows: string[]): string {
  return [HEADER, ...rows].join("\n") + "\n"
}

function issuesOf(text: string): ImportIssue[] {
  const result = parseTradesCsv(text)
  if (result.ok) throw new Error("expected import to fail")
  return result.issues
}

function codesOf(text: string): string[] {
  return issuesOf(text).map((issue) => issue.code)
}

describe("parseCsv", () => {
  it("handles BOM, CRLF, quotes and blank lines while keeping line numbers", () => {
    const records = parseCsv('\uFEFFa,b\r\n"x,1","he said ""hi"""\r\n\r\nc,d\r\n\r\n')
    expect(records).toEqual([
      { line: 1, cells: ["a", "b"] },
      { line: 2, cells: ["x,1", 'he said "hi"'] },
      { line: 4, cells: ["c", "d"] },
    ])
  })

  it("counts newlines inside quoted fields", () => {
    const records = parseCsv('a\n"x\ny"\nz')
    expect(records.map((r) => r.line)).toEqual([1, 2, 4])
  })
})

describe("parseTradesCsv - valid input", () => {
  it("accepts a header-only file with zero trades", () => {
    expect(parseTradesCsv(HEADER + "\n")).toEqual({ ok: true, trades: [] })
  })

  it("normalizes timestamps to UTC, preserves strings and computes the exact gross value", () => {
    const result = parseTradesCsv(csv("T1,2025-10-01T11:00:00+02:00,Binance,BTC,BUY,0.03141403,105507.74,3.31"))
    expect(result).toEqual({
      ok: true,
      trades: [
        {
          tradeId: "T1",
          timestamp: "2025-10-01T09:00:00.000Z",
          exchange: "Binance",
          symbol: "BTC",
          side: "BUY",
          quantity: "0.03141403",
          priceUsd: "105507.74",
          feeUsd: "3.31",
          // 0.03141403 x 105507.74 = 3314.4233095922 (exact, 10 decimals = 8 + 2)
          grossValueUsd: "3314.4233095922",
        },
      ],
    })
  })

  it("sorts ascending by timestamp, keeping file order for ties", () => {
    const result = parseTradesCsv(
      csv(
        "C,2025-01-03T00:00:00Z,Binance,BTC,BUY,1,100,0",
        "A,2025-01-01T00:00:00Z,Binance,BTC,BUY,1,100,0",
        "B,2025-01-01T00:00:00Z,Coinbase,BTC,BUY,1,100,0"
      )
    )
    expect(result.ok && result.trades.map((t) => t.tradeId)).toEqual(["A", "B", "C"])
  })
})

describe("parseTradesCsv - invalid input", () => {
  it("rejects an empty file", () => {
    expect(codesOf("")).toEqual(["EMPTY_FILE"])
    expect(codesOf("\n\n")).toEqual(["EMPTY_FILE"])
  })

  it("reports each missing column and stops", () => {
    const issues = issuesOf("trade_id,timestamp,exchange,symbol,side,quantity\nT1,2025-01-01T00:00:00Z,Binance,BTC,BUY,1\n")
    expect(issues.map((i) => [i.code, i.field])).toEqual([
      ["MISSING_COLUMN", "price_usd"],
      ["MISSING_COLUMN", "fee_usd"],
    ])
  })

  it("reports duplicate trade ids naming both rows", () => {
    const issues = issuesOf(
      csv("T1,2025-01-01T00:00:00Z,Binance,BTC,BUY,1,100,0", "T1,2025-01-02T00:00:00Z,Binance,BTC,BUY,1,100,0")
    )
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ code: "DUPLICATE_TRADE_ID", row: 3, tradeId: "T1" })
    expect(issues[0].message).toContain("Row 3")
    expect(issues[0].message).toContain("row 2")
  })

  it.each([
    ["no timezone", "2025-01-01T00:00:00"],
    ["date only", "2025-01-01"],
    ["impossible calendar date", "2025-02-30T00:00:00Z"],
    ["hour 24", "2025-01-01T24:00:00Z"],
    ["garbage", "yesterday"],
    ["empty", ""],
  ])("rejects timestamp: %s", (_name, timestamp) => {
    expect(codesOf(csv(`T1,${timestamp},Binance,BTC,BUY,1,100,0`))).toEqual(["INVALID_TIMESTAMP"])
  })

  it("rejects unsupported exchange, symbol and side", () => {
    expect(codesOf(csv("T1,2025-01-01T00:00:00Z,Kraken,BTC,BUY,1,100,0"))).toEqual(["UNSUPPORTED_EXCHANGE"])
    expect(codesOf(csv("T1,2025-01-01T00:00:00Z,Binance,XRP,BUY,1,100,0"))).toEqual(["UNSUPPORTED_SYMBOL"])
    expect(codesOf(csv("T1,2025-01-01T00:00:00Z,Binance,BTC,HOLD,1,100,0"))).toEqual(["UNSUPPORTED_SIDE"])
    expect(codesOf(csv("T1,2025-01-01T00:00:00Z,binance,BTC,BUY,1,100,0"))).toEqual(["UNSUPPORTED_EXCHANGE"])
  })

  it("rejects quantity 0, negative, and non-numeric with an actionable message", () => {
    const issues = issuesOf(
      csv(
        "T1,2025-01-01T00:00:00Z,Binance,BTC,BUY,0,100,0",
        "TRD-0013,2025-01-01T00:00:00Z,Binance,BTC,BUY,-1,100,0",
        "T3,2025-01-01T00:00:00Z,Binance,BTC,BUY,1e3,100,0"
      )
    )
    expect(issues.map((i) => i.code)).toEqual(["INVALID_QUANTITY", "INVALID_QUANTITY", "INVALID_QUANTITY"])
    expect(issues[1].message).toBe('Row 3 (TRD-0013): quantity "-1" must be a number greater than 0.')
  })

  it("rejects price 0 and negative fee", () => {
    expect(codesOf(csv("T1,2025-01-01T00:00:00Z,Binance,BTC,BUY,1,0,0"))).toEqual(["INVALID_PRICE"])
    expect(codesOf(csv("T1,2025-01-01T00:00:00Z,Binance,BTC,BUY,1,100,-0.5"))).toEqual(["INVALID_FEE"])
  })

  it("accepts a zero fee", () => {
    expect(parseTradesCsv(csv("T1,2025-01-01T00:00:00Z,Binance,BTC,BUY,1,100,0")).ok).toBe(true)
  })

  it("rejects malformed rows (wrong cell count)", () => {
    const issues = issuesOf(csv("T1,2025-01-01T00:00:00Z,Binance,BTC,BUY,1,100", "T2,2025-01-01T00:00:00Z,Binance,BTC,BUY,1,100,0,9"))
    expect(issues.map((i) => i.code)).toEqual(["MALFORMED_ROW", "MALFORMED_ROW"])
    expect(issues[0].message).toBe("Row 2: expected 8 columns but found 7.")
  })

  it("collects all row issues and is atomic: only issues, never trades", () => {
    const result = parseTradesCsv(
      csv(
        "T1,2025-01-01T00:00:00Z,Binance,BTC,BUY,1,100,0",
        "T2,bad,Binance,BTC,BUY,1,100,0",
        "T3,2025-01-01T00:00:00Z,Binance,BTC,BUY,0,100,0"
      )
    )
    expect(result.ok).toBe(false)
    expect(result).not.toHaveProperty("trades")
    expect(result.ok ? [] : result.issues.map((i) => i.row)).toEqual([3, 4])
  })

  it("caps the number of issues at 200", () => {
    const rows = Array.from({ length: 300 }, (_, i) => `T${i},2025-01-01T00:00:00Z,Binance,BTC,BUY,0,100,0`)
    expect(issuesOf(csv(...rows))).toHaveLength(200)
  })
})

describe("parseTradesCsv - SELL vs holdings", () => {
  it("rejects a SELL that exceeds the quantity held", () => {
    // held 1, sell 1.5
    const issues = issuesOf(
      csv("B,2025-01-01T00:00:00Z,Binance,BTC,BUY,1,100,0", "S,2025-01-02T00:00:00Z,Coinbase,BTC,SELL,1.5,100,0")
    )
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ code: "SELL_EXCEEDS_HOLDINGS", row: 3, tradeId: "S" })
    expect(issues[0].message).toContain("Row 3 (S)")
    expect(issues[0].message).toContain("1.5 BTC")
    expect(issues[0].message).toContain("only 1 BTC held")
  })

  it("orders by timestamp, not file order: a SELL earlier than its BUY is rejected even if listed later", () => {
    const issues = issuesOf(
      csv("B,2025-01-02T00:00:00Z,Binance,BTC,BUY,1,100,0", "S,2025-01-01T00:00:00Z,Binance,BTC,SELL,1,100,0")
    )
    expect(issues.map((i) => [i.code, i.tradeId])).toEqual([["SELL_EXCEEDS_HOLDINGS", "S"]])
    expect(issues[0].message).toContain("only 0 BTC held")
  })

  it("accepts a SELL listed before its BUY in the file when the BUY happened earlier in time", () => {
    const result = parseTradesCsv(
      csv("S,2025-01-02T00:00:00Z,Binance,BTC,SELL,1,100,0", "B,2025-01-01T00:00:00Z,Binance,BTC,BUY,1,100,0")
    )
    expect(result.ok && result.trades.map((t) => t.tradeId)).toEqual(["B", "S"])
  })

  it("accepts a SELL exactly equal to the held quantity (exact decimal compare)", () => {
    // 0.1 + 0.2 = 0.3 exactly in decimal arithmetic
    const result = parseTradesCsv(
      csv(
        "B1,2025-01-01T00:00:00Z,Binance,BTC,BUY,0.1,100,0",
        "B2,2025-01-02T00:00:00Z,Coinbase,BTC,BUY,0.2,100,0",
        "S,2025-01-03T00:00:00Z,Binance,BTC,SELL,0.3,100,0"
      )
    )
    expect(result.ok).toBe(true)
  })

  it("pools holdings across exchanges but not across symbols", () => {
    expect(parseTradesCsv(csv("B,2025-01-01T00:00:00Z,Binance,BTC,BUY,1,100,0", "S,2025-01-02T00:00:00Z,Coinbase,BTC,SELL,1,100,0")).ok).toBe(true)
    expect(codesOf(csv("B,2025-01-01T00:00:00Z,Binance,BTC,BUY,1,100,0", "S,2025-01-02T00:00:00Z,Binance,ETH,SELL,1,100,0"))).toEqual(["SELL_EXCEEDS_HOLDINGS"])
  })

  it("does not run the holdings check when row-level issues exist", () => {
    expect(codesOf(csv("S,2025-01-02T00:00:00Z,Binance,BTC,SELL,1,100,0", "X,bad,Binance,BTC,BUY,1,100,0"))).toEqual(["INVALID_TIMESTAMP"])
  })
})

describe("parsePricesCsv", () => {
  const header = "as_of,symbol,price_usd"

  it("parses prices and uses the latest as_of", () => {
    const snapshot = parsePricesCsv(`${header}\n2026-03-30T00:00:00Z,BTC,100.50\n2026-03-31T00:00:00+00:00,ETH,2\n`)
    expect(snapshot).toEqual({ asOf: "2026-03-31T00:00:00.000Z", prices: { BTC: "100.50", ETH: "2" } })
  })

  it.each([
    ["", /empty/],
    ["as_of,symbol\n", /price_usd/],
    [`${header}\n`, /no price rows/],
    [`${header}\nnope,BTC,1\n`, /as_of/],
    [`${header}\n2026-03-31T00:00:00Z,XRP,1\n`, /not supported/],
    [`${header}\n2026-03-31T00:00:00Z,BTC,0\n`, /greater than 0/],
    [`${header}\n2026-03-31T00:00:00Z,BTC,-1\n`, /greater than 0/],
    [`${header}\n2026-03-31T00:00:00Z,BTC,1\n2026-03-31T00:00:00Z,BTC,2\n`, /already has a price/],
  ])("throws a clear error for invalid input %#", (text, message) => {
    expect(() => parsePricesCsv(text)).toThrow(message)
  })
})
