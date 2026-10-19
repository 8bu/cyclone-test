import { PieChartIcon } from "lucide-react"
import { Pie, PieChart } from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Decimal } from "@/domain/decimal"
import type { AssetSymbol, Holding } from "@/domain/types"
import { formatPercent, formatUsd, toChartNumber } from "@/lib/format"

/** Stable colour per asset (blue, violet, teal, amber, rose). */
const SYMBOL_COLORS: Record<AssetSymbol, string> = {
  BTC: "var(--chart-1)",
  ETH: "var(--chart-4)",
  SOL: "var(--chart-2)",
  CKB: "var(--chart-3)",
  DOGE: "var(--chart-5)",
}

interface Slice {
  symbol: AssetSymbol
  value: number
  valueStr: string
  allocationStr: string | null
  fill: string
}

export function AllocationChart({
  holdings,
  totalValue,
}: {
  holdings: Holding[]
  totalValue: string
}) {
  const slices: Slice[] = holdings.flatMap((h) =>
    h.currentValue !== null && new Decimal(h.currentValue).gt(0)
      ? [
          {
            symbol: h.symbol,
            value: toChartNumber(h.currentValue),
            valueStr: h.currentValue,
            allocationStr: h.allocation,
            fill: SYMBOL_COLORS[h.symbol],
          },
        ]
      : []
  )

  const config: ChartConfig = Object.fromEntries(
    slices.map((s) => [s.symbol, { label: s.symbol, color: s.fill }])
  )

  const summary = slices
    .map((s) => `${s.symbol} ${formatPercent(s.allocationStr)}`)
    .join(", ")

  return (
    <section aria-labelledby="allocation-heading" className="min-w-0">
      <Card className="h-full min-w-0">
        <CardHeader>
          <CardTitle>
            <h2 id="allocation-heading" className="text-base font-medium">
              Allocation
            </h2>
          </CardTitle>
          <CardDescription>Share of current portfolio value by asset.</CardDescription>
        </CardHeader>
        <CardContent className="min-w-0">
          {slices.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <PieChartIcon />
                </EmptyMedia>
                <EmptyTitle>No priced holdings</EmptyTitle>
                <EmptyDescription>
                  Allocation needs at least one open position with a price.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col items-center gap-6 sm:flex-row lg:flex-col xl:flex-row">
              <div
                role="img"
                aria-label={`Allocation donut chart of ${formatUsd(totalValue)}: ${summary}`}
                className="relative mx-auto w-full max-w-60 sm:mx-0 sm:w-52 sm:shrink-0 lg:mx-auto lg:w-full xl:mx-0 xl:w-56"
              >
                <ChartContainer config={config} className="aspect-square w-full">
                  <PieChart>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          hideLabel
                          nameKey="symbol"
                          formatter={(_value, name, item) => (
                            <>
                              <span
                                aria-hidden="true"
                                className="size-2.5 shrink-0 rounded-[2px]"
                                style={{ backgroundColor: item.payload?.fill }}
                              />
                              <span className="flex flex-1 justify-between gap-4">
                                <span className="text-muted-foreground">{name}</span>
                                <span className="font-mono font-medium tabular-nums">
                                  {formatUsd(item.payload?.valueStr)}
                                </span>
                              </span>
                            </>
                          )}
                        />
                      }
                    />
                    <Pie
                      data={slices}
                      dataKey="value"
                      nameKey="symbol"
                      innerRadius="62%"
                      outerRadius="100%"
                      stroke="var(--card)"
                      strokeWidth={2}
                    />
                  </PieChart>
                </ChartContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xs text-muted-foreground">Total</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatUsd(totalValue)}
                  </span>
                </div>
              </div>
              <ul className="flex w-full min-w-0 flex-1 flex-col gap-2" aria-label="Allocation by asset">
                {slices.map((s) => (
                  <li
                    key={s.symbol}
                    className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm"
                  >
                    <span
                      aria-hidden="true"
                      className="size-3 shrink-0 rounded-[3px] border border-border"
                      style={{ backgroundColor: s.fill }}
                    />
                    <span className="font-medium">{s.symbol}</span>
                    <span className="ml-auto text-muted-foreground tabular-nums">
                      {formatPercent(s.allocationStr)}
                    </span>
                    <span className="min-w-24 text-right tabular-nums">{formatUsd(s.valueStr)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
