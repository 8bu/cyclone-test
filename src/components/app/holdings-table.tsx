import { PnlValue } from "@/components/app/pnl-value"
import { NoPositionsState } from "@/components/app/states"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Holding, PortfolioSummary } from "@/domain/types"
import {
  EM_DASH,
  formatPercent,
  formatPrice,
  formatQuantity,
  formatUsd,
  toChartNumber,
} from "@/lib/format"
import { cn } from "@/lib/utils"

const STICKY_CELL = "sticky left-0 z-10 bg-card"
const NUM = "text-right tabular-nums"

function AllocationCell({ allocation }: { allocation: string | null }) {
  if (allocation === null) return <span className="text-muted-foreground">{EM_DASH}</span>
  const width = Math.min(100, Math.max(0, toChartNumber(allocation) * 100))
  return (
    <div className="flex items-center justify-end gap-2">
      <span>{formatPercent(allocation)}</span>
      <div
        aria-hidden="true"
        className="relative h-2 w-24 shrink-0 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="absolute inset-y-0 left-0 bg-primary"
          style={{ width: `${width.toFixed(2)}%` }}
        />
      </div>
    </div>
  )
}

function HoldingRow({ holding }: { holding: Holding }) {
  const closed = holding.quantity === "0"
  const noPrice = holding.currentPrice === null

  return (
    <TableRow>
      <TableHead scope="row" className={cn(STICKY_CELL, "px-2")}>
        <div className="flex items-center gap-2">
          <span>{holding.symbol}</span>
          {closed && <Badge variant="secondary">Closed</Badge>}
          {noPrice && <Badge variant="outline">No price</Badge>}
        </div>
      </TableHead>
      <TableCell className={NUM}>{formatQuantity(holding.quantity)}</TableCell>
      <TableCell className={NUM}>{closed ? EM_DASH : formatPrice(holding.avgCost)}</TableCell>
      <TableCell className={NUM}>{formatPrice(holding.currentPrice)}</TableCell>
      <TableCell className={NUM}>{formatUsd(holding.costBasis)}</TableCell>
      <TableCell className={NUM}>{formatUsd(holding.currentValue)}</TableCell>
      <TableCell className={NUM}>
        <PnlValue value={holding.realizedPnl} />
      </TableCell>
      <TableCell className={NUM}>
        <div className="flex flex-col items-end">
          <PnlValue value={holding.unrealizedPnl} />
          {holding.unrealizedPnlPct !== null && (
            <PnlValue
              value={holding.unrealizedPnlPct}
              kind="percent"
              showIcon={false}
              className="text-xs"
            />
          )}
        </div>
      </TableCell>
      <TableCell className={NUM}>
        <PnlValue value={holding.totalPnl} />
      </TableCell>
      <TableCell className={NUM}>
        <AllocationCell allocation={holding.allocation} />
      </TableCell>
    </TableRow>
  )
}

export function HoldingsTable({
  holdings,
  summary,
}: {
  holdings: Holding[]
  summary: PortfolioSummary
}) {
  return (
    <section aria-labelledby="holdings-heading">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 id="holdings-heading" className="text-base font-medium">
              Holdings
            </h2>
          </CardTitle>
          <CardDescription>
            One row per asset, pooled across Binance and Coinbase. Closed
            positions stay visible with their realized P&amp;L.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {holdings.length === 0 ? (
            <NoPositionsState />
          ) : (
            <Table>
              <TableCaption className="sr-only">
                Holdings with quantity, average cost, current price, cost
                basis, value, realized and unrealized P&amp;L and allocation.
                The last row shows portfolio totals.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col" className={cn(STICKY_CELL, "px-2")}>
                    Asset
                  </TableHead>
                  <TableHead scope="col" className={NUM}>Quantity</TableHead>
                  <TableHead scope="col" className={NUM}>Avg cost</TableHead>
                  <TableHead scope="col" className={NUM}>Price</TableHead>
                  <TableHead scope="col" className={NUM}>Cost basis</TableHead>
                  <TableHead scope="col" className={NUM}>Value</TableHead>
                  <TableHead scope="col" className={NUM}>Realized</TableHead>
                  <TableHead scope="col" className={NUM}>Unrealized</TableHead>
                  <TableHead scope="col" className={NUM}>Total P&amp;L</TableHead>
                  <TableHead scope="col" className={NUM}>Allocation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holdings.map((h) => (
                  <HoldingRow key={h.symbol} holding={h} />
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableHead scope="row" className={cn(STICKY_CELL, "px-2")}>
                    Total
                  </TableHead>
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell className={NUM}>{formatUsd(summary.costBasis)}</TableCell>
                  <TableCell className={NUM}>{formatUsd(summary.portfolioValue)}</TableCell>
                  <TableCell className={NUM}>
                    <PnlValue value={summary.realizedPnl} />
                  </TableCell>
                  <TableCell className={NUM}>
                    <div className="flex flex-col items-end">
                      <PnlValue value={summary.unrealizedPnl} />
                      {summary.unrealizedPnlPct !== null && (
                        <PnlValue
                          value={summary.unrealizedPnlPct}
                          kind="percent"
                          showIcon={false}
                          className="text-xs"
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className={NUM}>
                    <PnlValue value={summary.totalPnl} />
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
