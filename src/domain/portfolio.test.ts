import { describe, expect, it } from "vitest"

import pricesCsv from "../../problems/prices.csv?raw"
import tradesCsv from "../../problems/trades.csv?raw"

import { Decimal } from "@/domain/decimal"
import { parseTradesCsv } from "@/domain/import"
import { computePortfolio } from "@/domain/portfolio"
import { parsePricesCsv } from "@/domain/prices"
import type { Holding, PriceSnapshot, Trade } from "@/domain/types"

const HEADER = "trade_id,timestamp,exchange,symbol,side,quantity,price_usd,fee_usd"

/** Rows: "<id> <day> <exchange> <symbol> <side> <qty> <price> <fee>"; day = 2025-01-<day>. */
function load(...rows: string[]): Trade[] {
  const lines = rows.map((row) => {
    const [id, day, exchange, symbol, side, qty, price, fee] = row.split(/\s+/)
    return `${id},2025-01-${day.padStart(2, "0")}T00:00:00Z,${exchange},${symbol},${side},${qty},${price},${fee}`
  })
  const result = parseTradesCsv([HEADER, ...lines].join("\n"))
  if (!result.ok) throw new Error(result.issues.map((i) => i.message).join("\n"))
  return result.trades
}

function holding(holdings: Holding[], symbol: string): Holding {
  const found = holdings.find((h) => h.symbol === symbol)
  if (!found) throw new Error(`no holding for ${symbol}`)
  return found
}

function expectDecimal(actual: string | null, expected: string, dp: number) {
  expect(actual).not.toBeNull()
  expect(new Decimal(actual!).toFixed(dp)).toBe(new Decimal(expected).toFixed(dp))
}

describe("computePortfolio - cost basis", () => {
  it("(a) averages multiple BUYs at different prices", () => {
    const p = computePortfolio(
      load("T1 1 Binance BTC BUY 1 100 0", "T2 2 Binance BTC BUY 3 200 0"),
      null
    )
    // cost = 1x100 + 3x200 = 700; qty = 4; avg = 700 / 4 = 175
    const btc = holding(p.holdings, "BTC")
    expect(btc.quantity).toBe("4")
    expect(btc.costBasis).toBe("700")
    expect(btc.avgCost).toBe("175")
    expect(p.effects["T1"]).toEqual({ tradeId: "T1", quantityAfter: "1", costBasisAfter: "100", avgCostAfter: "100", realizedPnl: null })
    expect(p.effects["T2"].avgCostAfter).toBe("175")
  })

  it("(b) capitalizes BUY fees into the average cost", () => {
    const p = computePortfolio(
      load("T1 1 Binance BTC BUY 1 100 1", "T2 2 Coinbase BTC BUY 1 200 2"),
      null
    )
    // cost = (1x100 + 1) + (1x200 + 2) = 303; qty = 2; avg = 151.5
    const btc = holding(p.holdings, "BTC")
    expect(btc.quantity).toBe("2")
    expect(btc.costBasis).toBe("303")
    expect(btc.avgCost).toBe("151.5")
    expect(p.summary.totalFees).toBe("3")
  })

  it("(c) deducts the SELL fee from proceeds and keeps the average cost unchanged", () => {
    const p = computePortfolio(
      load("T1 1 Binance BTC BUY 1 100 1", "T2 2 Coinbase BTC BUY 1 200 2", "T3 3 Binance BTC SELL 0.5 300 1"),
      null
    )
    // net proceeds = 0.5x300 - 1 = 149
    // cost removed = 303 x 0.5 / 2 = 75.75; realized = 149 - 75.75 = 73.25
    // remaining qty = 1.5; cost = 303 - 75.75 = 227.25; avg = 227.25 / 1.5 = 151.5 (unchanged)
    expect(p.effects["T3"]).toEqual({
      tradeId: "T3",
      quantityAfter: "1.5",
      costBasisAfter: "227.25",
      avgCostAfter: "151.5",
      realizedPnl: "73.25",
    })
    const btc = holding(p.holdings, "BTC")
    expect(btc.realizedPnl).toBe("73.25")
    expect(btc.avgCost).toBe("151.5")
    expect(btc.totalFees).toBe("4")
    expect(p.summary.realizedPnl).toBe("73.25")
  })

  it("(d) resets to exactly zero on a full close; the next BUY starts from scratch", () => {
    const closed = computePortfolio(
      load("T1 1 Binance BTC BUY 3 100.1 0.3", "T2 2 Binance BTC SELL 1 120 0", "T3 3 Binance BTC SELL 2 130 0.7"),
      null
    )
    // cost = 3x100.1 + 0.3 = 300.6; qty 3; avg 100.2
    // SELL 1@120: removed 100.2, realized 19.8; qty 2, cost 200.4
    // SELL 2@130 fee 0.7: net 259.3; removed 200.4; realized 58.9 -> qty 0, cost exactly 0
    expect(closed.effects["T2"].realizedPnl).toBe("19.8")
    expect(closed.effects["T3"]).toEqual({
      tradeId: "T3",
      quantityAfter: "0",
      costBasisAfter: "0",
      avgCostAfter: "0",
      realizedPnl: "58.9",
    })
    // The closed asset stays visible because of its realized P&L.
    const btc = holding(closed.holdings, "BTC")
    expect(btc).toMatchObject({ quantity: "0", costBasis: "0", avgCost: "0", realizedPnl: "78.7", totalFees: "1", tradeCount: 3 })

    const reopened = computePortfolio(
      load(
        "T1 1 Binance BTC BUY 3 100.1 0.3",
        "T2 2 Binance BTC SELL 1 120 0",
        "T3 3 Binance BTC SELL 2 130 0.7",
        "T4 4 Coinbase BTC BUY 1 50 1"
      ),
      null
    )
    // new cost = 1x50 + 1 = 51, uncontaminated by the old 100.2 average
    expect(reopened.effects["T4"]).toMatchObject({ quantityAfter: "1", costBasisAfter: "51", avgCostAfter: "51", realizedPnl: null })
    expect(holding(reopened.holdings, "BTC")).toMatchObject({ quantity: "1", costBasis: "51", avgCost: "51", realizedPnl: "78.7" })
  })

  it("pools across exchanges and keeps symbols separate", () => {
    const p = computePortfolio(
      load("T1 1 Binance BTC BUY 1 100 0", "T2 2 Coinbase BTC SELL 1 150 0", "T3 3 Binance ETH BUY 2 10 0"),
      null
    )
    // BTC bought on Binance, sold on Coinbase: realized = 150 - 100 = 50
    expect(holding(p.holdings, "BTC").realizedPnl).toBe("50")
    expect(holding(p.holdings, "ETH")).toMatchObject({ quantity: "2", costBasis: "20" })
  })

  it("sorts a copy of the input by timestamp (stable) and does not mutate it", () => {
    const [buy, sell] = load("B 1 Binance BTC BUY 1 100 0", "S 2 Binance BTC SELL 1 150 0")
    const input = [sell, buy]
    const p = computePortfolio(input, null)
    expect(input).toEqual([sell, buy])
    expect(p.effects["S"].realizedPnl).toBe("50")
  })

  it("throws if a SELL exceeds the quantity held (defensive)", () => {
    const [buy, sell] = load("B 1 Binance BTC BUY 1 100 0", "S 2 Binance BTC SELL 1 150 0")
    expect(() => computePortfolio([buy, { ...sell, quantity: "2" }], null)).toThrow(/cannot SELL/)
  })

  it("returns zeros and no holdings for an empty trade list", () => {
    const p = computePortfolio([], null)
    expect(p.asOf).toBeNull()
    expect(p.holdings).toEqual([])
    expect(p.effects).toEqual({})
    expect(p.summary).toEqual({
      portfolioValue: "0",
      costBasis: "0",
      realizedPnl: "0",
      unrealizedPnl: "0",
      totalPnl: "0",
      totalFees: "0",
      tradeCount: 0,
      missingPrices: [],
      unrealizedPnlPct: null,
    })
  })
})

describe("computePortfolio - valuation", () => {
  const snapshot = (prices: PriceSnapshot["prices"]): PriceSnapshot => ({ asOf: "2025-02-01T00:00:00.000Z", prices })

  it("(g) yields nulls and missingPrices for a symbol without a price", () => {
    const trades = load("T1 1 Binance BTC BUY 1 100 0", "T2 2 Binance ETH BUY 2 10 1")
    const p = computePortfolio(trades, snapshot({ BTC: "150" }))
    // BTC: value 150, unrealized 150 - 100 = 50; ETH: cost 2x10 + 1 = 21, no price
    const eth = holding(p.holdings, "ETH")
    expect(eth).toMatchObject({
      costBasis: "21",
      currentPrice: null,
      currentValue: null,
      unrealizedPnl: null,
      totalPnl: null,
      unrealizedPnlPct: null,
      allocation: null,
      totalFees: "1",
    })
    expect(p.holdings.map((h) => h.symbol)).toEqual(["BTC", "ETH"]) // unpriced last
    expect(holding(p.holdings, "BTC")).toMatchObject({ currentValue: "150", unrealizedPnl: "50", unrealizedPnlPct: "0.5", allocation: "1" })
    expect(p.summary).toMatchObject({
      portfolioValue: "150", // priced holdings only
      costBasis: "121", // 100 + 21: unpriced holdings included
      unrealizedPnl: "50",
      unrealizedPnlPct: "0.5", // 50 / 100 (priced cost basis only)
      totalPnl: "50",
      totalFees: "1",
      missingPrices: ["ETH"],
    })
    expect(p.asOf).toBe("2025-02-01T00:00:00.000Z")
  })

  it("treats a null price snapshot as all prices missing", () => {
    const p = computePortfolio(load("T1 1 Binance BTC BUY 1 100 0"), null)
    expect(p.asOf).toBeNull()
    expect(p.summary).toMatchObject({ portfolioValue: "0", unrealizedPnl: "0", unrealizedPnlPct: null, missingPrices: ["BTC"] })
    expect(p.holdings[0]).toMatchObject({ currentPrice: null, allocation: null })
  })

  it("(h) allocation sums to 1 across priced holdings and sorts by value", () => {
    const trades = load("T1 1 Binance BTC BUY 1 100 0", "T2 2 Binance ETH BUY 2 10 0", "T3 3 Binance SOL BUY 3 10 0")
    const p = computePortfolio(trades, snapshot({ BTC: "200", ETH: "50", SOL: "100" }))
    // values: BTC 200, ETH 100, SOL 300 -> total 600 -> 1/3, 1/6, 1/2
    expect(p.holdings.map((h) => h.symbol)).toEqual(["SOL", "BTC", "ETH"])
    expect(p.summary.portfolioValue).toBe("600")
    expect(holding(p.holdings, "SOL").allocation).toBe("0.5")
    const total = p.holdings.reduce((sum, h) => sum.plus(h.allocation!), new Decimal(0))
    expect(total.toFixed(30)).toBe(new Decimal(1).toFixed(30))
  })

  it("keeps a closed asset visible with zero value and no allocation when the portfolio value is 0", () => {
    const trades = load("T1 1 Binance BTC BUY 1 100 1", "T2 2 Binance BTC SELL 1 150 2")
    const p = computePortfolio(trades, snapshot({ BTC: "999" }))
    // realized = (150 - 2) - 101 = 47; no units left
    expect(p.holdings).toHaveLength(1)
    expect(p.holdings[0]).toMatchObject({
      quantity: "0",
      currentValue: "0",
      realizedPnl: "47",
      unrealizedPnl: "0",
      totalPnl: "47",
      unrealizedPnlPct: null,
      allocation: null,
      totalFees: "3",
    })
    expect(p.summary).toMatchObject({ portfolioValue: "0", totalPnl: "47", totalFees: "3", missingPrices: [] })
  })
})

describe("computePortfolio - golden sample (independent Python Decimal reference)", () => {
  const imported = parseTradesCsv(tradesCsv)
  if (!imported.ok) throw new Error("sample trades.csv must import cleanly")
  const prices = parsePricesCsv(pricesCsv)
  const portfolio = computePortfolio(imported.trades, prices)

  it("imports all 200 rows and reads the price snapshot", () => {
    expect(imported.trades).toHaveLength(200)
    expect(portfolio.asOf).toBe("2026-03-31T23:59:59.000Z")
    expect(Object.keys(prices.prices).sort()).toEqual(["BTC", "CKB", "DOGE", "ETH", "SOL"])
  })

  it("matches the portfolio summary", () => {
    const s = portfolio.summary
    expectDecimal(s.portfolioValue, "60620.891610", 6)
    expectDecimal(s.costBasis, "59969.237419", 6)
    expectDecimal(s.realizedPnl, "-5052.962688", 6)
    expectDecimal(s.unrealizedPnl, "651.654191", 6)
    expectDecimal(s.totalPnl, "-4401.308497", 6)
    expectDecimal(s.totalFees, "2708.860000", 6)
    expect(s.tradeCount).toBe(200)
    expect(s.missingPrices).toEqual([])
  })

  it.each([
    ["BTC", "0.07742920", "9114.338240", "8633.355800", "-463.745975", "-480.982440", "486.420000"],
    ["CKB", "1947047", "13382.759245", "13921.386050", "1499.627490", "538.626805", "525.210000"],
    ["DOGE", "63970.78", "14390.532135", "15480.928760", "-2695.484056", "1090.396625", "648.580000"],
    ["ETH", "2.846898", "11648.427223", "11458.764450", "-984.425549", "-189.662773", "529.660000"],
    ["SOL", "53.3643", "11433.180577", "11126.456550", "-2408.934598", "-306.724027", "518.990000"],
  ])("matches holding %s", (symbol, quantity, costBasis, currentValue, realizedPnl, unrealizedPnl, totalFees) => {
    const h = holding(portfolio.holdings, symbol)
    expectDecimal(h.quantity, quantity, 8)
    expectDecimal(h.costBasis, costBasis, 6)
    expectDecimal(h.currentValue, currentValue, 6)
    expectDecimal(h.realizedPnl, realizedPnl, 6)
    expectDecimal(h.unrealizedPnl, unrealizedPnl, 6)
    expectDecimal(h.totalFees, totalFees, 6)
  })

  it("matches the BTC average cost and has no exponent notation anywhere", () => {
    expectDecimal(holding(portfolio.holdings, "BTC").avgCost, "117711.899901", 6)
    expect(JSON.stringify(portfolio)).not.toMatch(/\d[eE][+-]?\d/)
  })

  it("keeps effects consistent with the summary", () => {
    const realized = Object.values(portfolio.effects).reduce(
      (sum, effect) => (effect.realizedPnl === null ? sum : sum.plus(effect.realizedPnl)),
      new Decimal(0)
    )
    expect(realized.toFixed()).toBe(new Decimal(portfolio.summary.realizedPnl).toFixed())
    expect(Object.keys(portfolio.effects)).toHaveLength(200)

    const allocation = portfolio.holdings.reduce((sum, h) => sum.plus(h.allocation!), new Decimal(0))
    expect(allocation.toFixed(20)).toBe(new Decimal(1).toFixed(20))

    const values = portfolio.holdings.map((h) => new Decimal(h.currentValue!))
    for (let i = 1; i < values.length; i++) expect(values[i - 1].gte(values[i])).toBe(true)
  })
})
