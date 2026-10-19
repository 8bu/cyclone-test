import { BarChartIcon } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import type { Holding } from "@/domain/types"
import { formatCompactUsd, formatSignedUsd, toChartNumber } from "@/lib/format"

const config = {
  realized: { label: "Realized", color: "var(--chart-1)" },
  unrealized: { label: "Unrealized", color: "var(--chart-3)" },
} satisfies ChartConfig

interface Row {
  symbol: string
  realized: number
  unrealized: number
  realizedStr: string
  unrealizedStr: string
}

export function PnlChart({ holdings }: { holdings: Holding[] }) {
  const unpriced = holdings
    .filter((h) => h.unrealizedPnl === null && h.quantity !== "0")
    .map((h) => h.symbol)
  const rows: Row[] = holdings.map((h) => ({
    symbol: h.symbol,
    realized: toChartNumber(h.realizedPnl),
    unrealized: toChartNumber(h.unrealizedPnl),
    realizedStr: h.realizedPnl,
    unrealizedStr: h.unrealizedPnl ?? "0",
  }))

  const summary = rows
    .map(
      (r) =>
        `${r.symbol}: realized ${formatSignedUsd(r.realizedStr)}, unrealized ${formatSignedUsd(r.unrealizedStr)}`
    )
    .join("; ")

  return (
    <section aria-labelledby="pnl-heading" className="min-w-0">
      <Card className="h-full min-w-0">
        <CardHeader>
          <CardTitle>
            <h2 id="pnl-heading" className="text-base font-medium">
              Realized vs unrealized P&amp;L
            </h2>
          </CardTitle>
          <CardDescription>
            Per asset, in USD. Bars below zero are losses.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex min-w-0 flex-col gap-3">
          {rows.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BarChartIcon />
                </EmptyMedia>
                <EmptyTitle>No P&amp;L to show</EmptyTitle>
                <EmptyDescription>
                  There are no holdings with realized or unrealized results yet.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <div
                role="img"
                aria-label={`Bar chart of realized and unrealized P&L per asset. ${summary}`}
                className="min-w-0"
              >
                <ChartContainer
                  config={config}
                  className="aspect-auto h-64 w-full sm:h-72"
                >
                  <BarChart data={rows} margin={{ left: 0, right: 4, top: 8 }}>
                    <defs>
                      <pattern
                        id="pnl-unrealized-hatch"
                        patternUnits="userSpaceOnUse"
                        width="6"
                        height="6"
                        patternTransform="rotate(45)"
                      >
                        <rect
                          width="6"
                          height="6"
                          fill="var(--color-unrealized)"
                        />
                        <rect
                          width="2"
                          height="6"
                          fill="var(--card)"
                          fillOpacity="0.55"
                        />
                      </pattern>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="symbol"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      width={44}
                      tickCount={5}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: number) => formatCompactUsd(v)}
                    />
                    <ReferenceLine
                      y={0}
                      stroke="var(--foreground)"
                      strokeOpacity={0.5}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(_value, name, item) => {
                            const key = String(name)
                            const exact =
                              key === "realized"
                                ? item.payload?.realizedStr
                                : item.payload?.unrealizedStr
                            return (
                              <>
                                <span
                                  aria-hidden="true"
                                  className="size-2.5 shrink-0 rounded-[2px]"
                                  style={{
                                    backgroundColor: `var(--color-${key === "realized" ? "realized" : "unrealized"})`,
                                  }}
                                />
                                <span className="flex flex-1 justify-between gap-4">
                                  <span className="text-muted-foreground">
                                    {key === "realized"
                                      ? "Realized"
                                      : "Unrealized"}
                                  </span>
                                  <span className="font-mono font-medium tabular-nums">
                                    {formatSignedUsd(exact)}
                                  </span>
                                </span>
                              </>
                            )
                          }}
                        />
                      }
                    />
                    <Bar
                      dataKey="realized"
                      fill="var(--color-realized)"
                      radius={3}
                    />
                    <Bar
                      dataKey="unrealized"
                      fill="url(#pnl-unrealized-hatch)"
                      stroke="var(--color-unrealized)"
                      strokeWidth={1}
                      radius={3}
                    />
                  </BarChart>
                </ChartContainer>
              </div>
              <ul
                aria-label="Legend"
                className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs"
              >
                <li className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="size-3 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: "var(--color-realized)" }}
                  />
                  Realized
                </li>
                <li className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="size-3 shrink-0 rounded-[2px] border"
                    style={{
                      borderColor: "var(--color-unrealized)",
                      backgroundColor: "var(--color-unrealized)",
                      backgroundImage:
                        "repeating-linear-gradient(135deg, transparent 0 2px, var(--card) 2px 3px)",
                    }}
                  />
                  Unrealized
                </li>
              </ul>
              <div className="sr-only">
                <table>
                  <caption>
                    Realized and unrealized P&amp;L per asset (USD)
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Asset</th>
                      <th scope="col">Realized</th>
                      <th scope="col">Unrealized</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.symbol}>
                        <th scope="row">{r.symbol}</th>
                        <td>{formatSignedUsd(r.realizedStr)}</td>
                        <td>{formatSignedUsd(r.unrealizedStr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {unpriced.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  No price for {unpriced.join(", ")}: unrealized P&amp;L is
                  shown as $0.00 for {unpriced.length === 1 ? "it" : "them"} and
                  is excluded from the totals.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
