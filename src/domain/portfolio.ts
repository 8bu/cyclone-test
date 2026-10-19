import { Decimal } from "@/domain/decimal"
import {
  SYMBOLS,
  type AssetSymbol,
  type Holding,
  type Portfolio,
  type PriceSnapshot,
  type Trade,
  type TradeEffect,
} from "@/domain/types"

interface Position {
  quantity: Decimal
  costBasis: Decimal
  realizedPnl: Decimal
  totalFees: Decimal
  tradeCount: number
}

const ZERO = new Decimal(0)

/**
 * Pooled weighted-average cost basis per asset (all exchanges together).
 * BUY: cost += qty * price + fee. SELL: proceeds = qty * price - fee,
 * cost removed = costBasis * qty / quantity (average cost is unchanged),
 * realized = proceeds - cost removed. A full close resets cost to exactly 0.
 */
export function computePortfolio(trades: Trade[], prices: PriceSnapshot | null): Portfolio {
  const sorted = [...trades].sort((a, b) =>
    a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0
  )

  const positions = new Map<AssetSymbol, Position>()
  const effects: Record<string, TradeEffect> = {}

  for (const trade of sorted) {
    let position = positions.get(trade.symbol)
    if (!position) {
      position = { quantity: ZERO, costBasis: ZERO, realizedPnl: ZERO, totalFees: ZERO, tradeCount: 0 }
      positions.set(trade.symbol, position)
    }

    const quantity = new Decimal(trade.quantity)
    const gross = quantity.times(trade.priceUsd)
    const fee = new Decimal(trade.feeUsd)
    let realized: Decimal | null = null

    if (trade.side === "BUY") {
      position.quantity = position.quantity.plus(quantity)
      position.costBasis = position.costBasis.plus(gross).plus(fee)
    } else {
      if (quantity.gt(position.quantity)) {
        throw new Error(
          `Trade ${trade.tradeId}: cannot SELL ${trade.quantity} ${trade.symbol}; only ${position.quantity.toFixed()} held.`
        )
      }
      const proceeds = gross.minus(fee)
      // Full close removes the whole basis; otherwise round to 30 dp so sums of realized P&L stay exact in 40 digits.
      const removed = quantity.eq(position.quantity)
        ? position.costBasis
        : position.costBasis.times(quantity).div(position.quantity).toDecimalPlaces(30)
      realized = proceeds.minus(removed)
      position.realizedPnl = position.realizedPnl.plus(realized)
      position.quantity = position.quantity.minus(quantity)
      position.costBasis = position.quantity.isZero() ? ZERO : position.costBasis.minus(removed)
    }

    position.totalFees = position.totalFees.plus(fee)
    position.tradeCount += 1

    effects[trade.tradeId] = {
      tradeId: trade.tradeId,
      quantityAfter: position.quantity.toFixed(),
      costBasisAfter: position.costBasis.toFixed(),
      avgCostAfter: position.quantity.isZero() ? "0" : position.costBasis.div(position.quantity).toFixed(),
      realizedPnl: realized ? realized.toFixed() : null,
    }
  }

  const priceOf = (symbol: AssetSymbol): Decimal | null => {
    const price = prices?.prices[symbol]
    return price === undefined ? null : new Decimal(price)
  }

  let portfolioValue = ZERO
  let costBasis = ZERO
  let realizedPnl = ZERO
  let unrealizedPnl = ZERO
  let pricedCostBasis = ZERO
  let totalFees = ZERO
  const missingPrices: AssetSymbol[] = []

  for (const symbol of SYMBOLS) {
    const position = positions.get(symbol)
    if (!position) continue
    const price = priceOf(symbol)
    costBasis = costBasis.plus(position.costBasis)
    realizedPnl = realizedPnl.plus(position.realizedPnl)
    totalFees = totalFees.plus(position.totalFees)
    if (price) {
      const value = position.quantity.times(price)
      portfolioValue = portfolioValue.plus(value)
      unrealizedPnl = unrealizedPnl.plus(value.minus(position.costBasis))
      pricedCostBasis = pricedCostBasis.plus(position.costBasis)
    } else if (position.quantity.gt(0)) {
      missingPrices.push(symbol)
    }
  }

  const rows: { holding: Holding; value: Decimal | null }[] = []
  for (const symbol of SYMBOLS) {
    const position = positions.get(symbol)
    if (!position) continue
    if (!position.quantity.gt(0) && position.realizedPnl.isZero()) continue

    const price = priceOf(symbol)
    const value = price ? position.quantity.times(price) : null
    const unrealized = value ? value.minus(position.costBasis) : null
    const holding: Holding = {
      symbol,
      quantity: position.quantity.toFixed(),
      avgCost: position.quantity.isZero() ? "0" : position.costBasis.div(position.quantity).toFixed(),
      costBasis: position.costBasis.toFixed(),
      currentPrice: price ? price.toFixed() : null,
      currentValue: value ? value.toFixed() : null,
      realizedPnl: position.realizedPnl.toFixed(),
      unrealizedPnl: unrealized ? unrealized.toFixed() : null,
      totalPnl: unrealized ? position.realizedPnl.plus(unrealized).toFixed() : null,
      unrealizedPnlPct: unrealized && !position.costBasis.isZero() ? unrealized.div(position.costBasis).toFixed() : null,
      allocation: value && !portfolioValue.isZero() ? value.div(portfolioValue).toFixed() : null,
      totalFees: position.totalFees.toFixed(),
      tradeCount: position.tradeCount,
    }
    rows.push({ holding, value })
  }

  rows.sort((a, b) => {
    if (a.value && b.value) {
      const byValue = b.value.cmp(a.value)
      if (byValue !== 0) return byValue
    } else if (a.value) {
      return -1
    } else if (b.value) {
      return 1
    }
    return a.holding.symbol.localeCompare(b.holding.symbol)
  })

  return {
    asOf: prices?.asOf ?? null,
    summary: {
      portfolioValue: portfolioValue.toFixed(),
      costBasis: costBasis.toFixed(),
      realizedPnl: realizedPnl.toFixed(),
      unrealizedPnl: unrealizedPnl.toFixed(),
      totalPnl: realizedPnl.plus(unrealizedPnl).toFixed(),
      totalFees: totalFees.toFixed(),
      tradeCount: sorted.length,
      missingPrices,
      unrealizedPnlPct: pricedCostBasis.isZero() ? null : unrealizedPnl.div(pricedCostBasis).toFixed(),
    },
    holdings: rows.map((row) => row.holding),
    effects,
  }
}
