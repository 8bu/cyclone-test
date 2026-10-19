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
const XL_ONLY = "hidden xl:table-cell"

function AllocationCell({
  allocation,
  barClassName = "w-24",
}: {
  allocation: string | null
  barClassName?: string
}) {
  if (allocation === null) return <span className="text-muted-foreground">{EM_DASH}</span>
  const width = Math.min(100, Math.max(0, toChartNumber(allocation) * 100))
  return (
    <div className="flex items-center justify-end gap-2">
      <span>{formatPercent(allocation)}</span>
      <div
        aria-hidden="true"
        className={cn(
          "relative h-2 shrink-0 overflow-hidden rounded-full bg-muted",
          barClassName
        )}
      >
        <div
          className="absolute inset-y-0 left-0 bg-primary"
          style={{ width: `${width.toFixed(2)}%` }}
        />
      </div>
    </div>
  )
}

function UnrealizedValue({
  pnl,
  pct,
  align = "end",
}: {
  pnl: string | null
  pct: string | null
  align?: "start" | "end"
}) {
  return (
    <div className={cn("flex flex-col", align === "end" ? "items-end" : "items-start")}>
      <PnlValue value={pnl} align={align} />
      {pct !== null && (
        <PnlValue
          value={pct}
          kind="percent"
          showIcon={false}
          align={align}
          className="text-xs"
        />
      )}
    </div>
  )
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words tabular-nums">{children}</dd>
    </div>
  )
}

function HoldingCard({ holding }: { holding: Holding }) {
  const closed = holding.quantity === "0"
  const noPrice = holding.currentPrice === null

  return (
    <li className="min-w-0">
      <Card size="sm">
        <CardContent className="flex min-w-0 flex-col gap-3">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="font-medium break-all">{holding.symbol}</span>
              {closed && <Badge variant="secondary">Closed</Badge>}
              {noPrice && <Badge variant="outline">No price</Badge>}
            </div>
            <AllocationCell allocation={holding.allocation} barClassName="w-16" />
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Metric label="Quantity">{formatQuantity(holding.quantity)}</Metric>
            <Metric label="Avg cost">
              {closed ? EM_DASH : formatPrice(holding.avgCost)}
            </Metric>
            <Metric label="Price">{formatPrice(holding.currentPrice)}</Metric>
            <Metric label="Cost basis">{formatUsd(holding.costBasis)}</Metric>
            <Metric label="Value">{formatUsd(holding.currentValue)}</Metric>
            <Metric label="Realized">
              <PnlValue value={holding.realizedPnl} align="start" />
            </Metric>
            <Metric label="Unrealized">
              <UnrealizedValue
                pnl={holding.unrealizedPnl}
                pct={holding.unrealizedPnlPct}
                align="start"
              />
            </Metric>
            <Metric label="Total P&L">
              <PnlValue value={holding.totalPnl} align="start" />
            </Metric>
          </dl>
        </CardContent>
      </Card>
    </li>
  )
}

function TotalsCard({ summary }: { summary: PortfolioSummary }) {
  return (
    <Card size="sm">
      <CardContent className="flex min-w-0 flex-col gap-3">
        <span className="font-medium">Total</span>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Metric label="Cost basis">{formatUsd(summary.costBasis)}</Metric>
          <Metric label="Value">{formatUsd(summary.portfolioValue)}</Metric>
          <Metric label="Realized">
            <PnlValue value={summary.realizedPnl} align="start" />
          </Metric>
          <Metric label="Unrealized">
            <UnrealizedValue
              pnl={summary.unrealizedPnl}
              pct={summary.unrealizedPnlPct}
              align="start"
            />
          </Metric>
          <Metric label="Total P&L">
            <PnlValue value={summary.totalPnl} align="start" />
          </Metric>
        </dl>
      </CardContent>
    </Card>
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
      <TableCell className={NUM}>
        <div className="flex flex-col items-end">
          <span>{formatQuantity(holding.quantity)}</span>
          <span className="text-xs text-muted-foreground xl:hidden">
            Avg {closed ? EM_DASH : formatPrice(holding.avgCost)}
          </span>
        </div>
      </TableCell>
      <TableCell className={cn(NUM, XL_ONLY)}>
        {closed ? EM_DASH : formatPrice(holding.avgCost)}
      </TableCell>
      <TableCell className={NUM}>{formatPrice(holding.currentPrice)}</TableCell>
      <TableCell className={cn(NUM, XL_ONLY)}>{formatUsd(holding.costBasis)}</TableCell>
      <TableCell className={NUM}>
        <div className="flex flex-col items-end">
          <span>{formatUsd(holding.currentValue)}</span>
          <span className="text-xs text-muted-foreground xl:hidden">
            Cost {formatUsd(holding.costBasis)}
          </span>
        </div>
      </TableCell>
      <TableCell className={NUM}>
        <PnlValue value={holding.realizedPnl} />
      </TableCell>
      <TableCell className={NUM}>
        <UnrealizedValue pnl={holding.unrealizedPnl} pct={holding.unrealizedPnlPct} />
      </TableCell>
      <TableCell className={NUM}>
        <PnlValue value={holding.totalPnl} />
      </TableCell>
      <TableCell className={NUM}>
        <AllocationCell allocation={holding.allocation} barClassName="w-12 xl:w-24" />
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
            <>
              <div className="min-w-0 lg:hidden">
                <ul className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                  {holdings.map((h) => (
                    <HoldingCard key={h.symbol} holding={h} />
                  ))}
                  <li className="min-w-0 sm:col-span-2">
                    <TotalsCard summary={summary} />
                  </li>
                </ul>
              </div>
              <div className="hidden lg:block">
                <Table>
                  <TableCaption className="sr-only">
                    Holdings with quantity, average cost, current price, cost
                    basis, value, realized and unrealized P&amp;L and
                    allocation. The last row shows portfolio totals.
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col" className={cn(STICKY_CELL, "px-2")}>
                        Asset
                      </TableHead>
                      <TableHead scope="col" className={NUM}>Quantity</TableHead>
                      <TableHead scope="col" className={cn(NUM, XL_ONLY)}>Avg cost</TableHead>
                      <TableHead scope="col" className={NUM}>Price</TableHead>
                      <TableHead scope="col" className={cn(NUM, XL_ONLY)}>Cost basis</TableHead>
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
                      <TableCell className={XL_ONLY} />
                      <TableCell />
                      <TableCell className={cn(NUM, XL_ONLY)}>
                        {formatUsd(summary.costBasis)}
                      </TableCell>
                      <TableCell className={NUM}>
                        <div className="flex flex-col items-end">
                          <span>{formatUsd(summary.portfolioValue)}</span>
                          <span className="text-xs text-muted-foreground xl:hidden">
                            Cost {formatUsd(summary.costBasis)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className={NUM}>
                        <PnlValue value={summary.realizedPnl} />
                      </TableCell>
                      <TableCell className={NUM}>
                        <UnrealizedValue
                          pnl={summary.unrealizedPnl}
                          pct={summary.unrealizedPnlPct}
                        />
                      </TableCell>
                      <TableCell className={NUM}>
                        <PnlValue value={summary.totalPnl} />
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
