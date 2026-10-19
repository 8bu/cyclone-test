import type { ReactNode } from "react"

import { PnlValue } from "@/components/app/pnl-value"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { PortfolioSummary } from "@/domain/types"
import { formatUsd } from "@/lib/format"

function SummaryCard({
  label,
  value,
  note,
}: {
  label: string
  value: ReactNode
  note?: ReactNode
}) {
  return (
    <Card size="sm" className="min-w-0">
      <CardHeader className="min-w-0">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-lg tabular-nums sm:text-xl lg:text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="min-h-4 text-xs text-muted-foreground">
        {note}
      </CardContent>
    </Card>
  )
}

export function SummaryCards({ summary }: { summary: PortfolioSummary }) {
  const partial = summary.missingPrices.length > 0

  return (
    <section aria-labelledby="summary-heading">
      <h2 id="summary-heading" className="sr-only">
        Portfolio summary
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <SummaryCard
          label="Portfolio value"
          value={formatUsd(summary.portfolioValue)}
          note={partial ? "Excludes assets without a price" : "Priced holdings at current prices"}
        />
        <SummaryCard
          label="Cost basis"
          value={formatUsd(summary.costBasis)}
          note="Pooled weighted average, fees included"
        />
        <SummaryCard
          label="Realized P&L"
          value={<PnlValue value={summary.realizedPnl} align="start" className="flex-wrap" />}
          note="From closed and partially sold positions"
        />
        <SummaryCard
          label="Unrealized P&L"
          value={<PnlValue value={summary.unrealizedPnl} align="start" className="flex-wrap" />}
          note={
            summary.unrealizedPnlPct === null ? (
              "No cost basis to compare against"
            ) : (
              <span className="inline-flex flex-wrap items-center gap-x-1">
                <PnlValue value={summary.unrealizedPnlPct} kind="percent" align="start" />
                <span>of cost basis</span>
              </span>
            )
          }
        />
        <SummaryCard
          label="Total P&L"
          value={<PnlValue value={summary.totalPnl} align="start" className="flex-wrap" />}
          note="Realized + unrealized"
        />
        <SummaryCard
          label="Total fees"
          value={formatUsd(summary.totalFees)}
          note={`Across ${summary.tradeCount} trade${summary.tradeCount === 1 ? "" : "s"}`}
        />
      </div>
    </section>
  )
}
