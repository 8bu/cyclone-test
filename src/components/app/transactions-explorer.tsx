import { useMemo, useState } from "react"
import { ArrowDownIcon, ArrowUpIcon, FilterXIcon, SearchXIcon } from "lucide-react"

import { PnlValue } from "@/components/app/pnl-value"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Decimal } from "@/domain/decimal"
import {
  EXCHANGES,
  SYMBOLS,
  type Trade,
  type TradeEffect,
} from "@/domain/types"
import {
  EM_DASH,
  formatDateTimeUtc,
  formatPrice,
  formatQuantity,
  formatUsd,
} from "@/lib/format"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 25
const ALL = "ALL"

interface Filters {
  asset: string
  exchange: string
  side: string
  from: string
  to: string
  query: string
  dir: "asc" | "desc"
  page: number
}

const INITIAL: Filters = {
  asset: ALL,
  exchange: ALL,
  side: ALL,
  from: "",
  to: "",
  query: "",
  dir: "desc",
  page: 1,
}

const NUM = "text-right tabular-nums"
const STICKY_CELL = "sticky left-0 z-10 bg-card"

function applyFilters(trades: Trade[], f: Filters) {
  const query = f.query.trim().toLowerCase()
  const rows = trades.filter((t) => {
    if (f.asset !== ALL && t.symbol !== f.asset) return false
    if (f.exchange !== ALL && t.exchange !== f.exchange) return false
    if (f.side !== ALL && t.side !== f.side) return false
    const day = t.timestamp.slice(0, 10)
    if (f.from && day < f.from) return false
    if (f.to && day > f.to) return false
    if (query && !t.tradeId.toLowerCase().includes(query)) return false
    return true
  })
  const sign = f.dir === "asc" ? 1 : -1
  return rows.sort(
    (a, b) =>
      sign *
      (a.timestamp === b.timestamp
        ? a.tradeId.localeCompare(b.tradeId)
        : a.timestamp < b.timestamp
          ? -1
          : 1)
  )
}

export function TransactionsExplorer({
  trades,
  effects,
}: {
  trades: Trade[]
  effects: Record<string, TradeEffect>
}) {
  const [filters, setFilters] = useState<Filters>(INITIAL)

  /** Every filter or sort change goes through here so the page always resets to 1. */
  const update = (patch: Partial<Omit<Filters, "page">>) =>
    setFilters((prev) => ({ ...prev, ...patch, page: 1 }))

  const { asset, exchange, side, from, to, query, dir } = filters
  const filtered = useMemo(
    () => applyFilters(trades, { asset, exchange, side, from, to, query, dir, page: 1 }),
    [trades, asset, exchange, side, from, to, query, dir]
  )

  const totals = useMemo(() => {
    let gross = new Decimal(0)
    let fees = new Decimal(0)
    for (const t of filtered) {
      gross = gross.plus(t.grossValueUsd)
      fees = fees.plus(t.feeUsd)
    }
    return { gross: gross.toString(), fees: fees.toString() }
  }, [filtered])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const page = Math.min(filters.page, pageCount)
  const start = (page - 1) * PAGE_SIZE
  const visible = filtered.slice(start, start + PAGE_SIZE)

  const isFiltered =
    asset !== ALL || exchange !== ALL || side !== ALL || from !== "" || to !== "" || query !== ""
  const clear = () => setFilters((prev) => ({ ...INITIAL, dir: prev.dir }))
  const goTo = (target: number) =>
    setFilters((prev) => ({ ...prev, page: Math.min(Math.max(1, target), pageCount) }))

  return (
    <section aria-labelledby="transactions-heading">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 id="transactions-heading" className="text-base font-medium">
              Transactions
            </h2>
          </CardTitle>
          <CardDescription>
            Every trade with its fee and the realized P&amp;L it produced.
            Dates are compared in UTC.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form
            role="search"
            aria-label="Filter transactions"
            onSubmit={(e) => e.preventDefault()}
          >
            <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field>
                <FieldLabel htmlFor="filter-asset">Asset</FieldLabel>
                <Select value={asset} onValueChange={(v) => update({ asset: v })}>
                  <SelectTrigger id="filter-asset" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={ALL}>All assets</SelectItem>
                      {SYMBOLS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="filter-exchange">Exchange</FieldLabel>
                <Select value={exchange} onValueChange={(v) => update({ exchange: v })}>
                  <SelectTrigger id="filter-exchange" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={ALL}>All exchanges</SelectItem>
                      {EXCHANGES.map((x) => (
                        <SelectItem key={x} value={x}>
                          {x}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel id="filter-side-label">Side</FieldLabel>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={side}
                  aria-labelledby="filter-side-label"
                  onValueChange={(v) => update({ side: v === "" ? ALL : v })}
                >
                  <ToggleGroupItem value={ALL}>All</ToggleGroupItem>
                  <ToggleGroupItem value="BUY">BUY</ToggleGroupItem>
                  <ToggleGroupItem value="SELL">SELL</ToggleGroupItem>
                </ToggleGroup>
              </Field>
              <Field>
                <FieldLabel htmlFor="filter-search">Trade ID</FieldLabel>
                <Input
                  id="filter-search"
                  type="search"
                  placeholder="e.g. TRD-0042"
                  value={query}
                  onChange={(e) => update({ query: e.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="filter-from">From (UTC)</FieldLabel>
                <Input
                  id="filter-from"
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => update({ from: e.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="filter-to">To (UTC)</FieldLabel>
                <Input
                  id="filter-to"
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => update({ to: e.target.value })}
                />
              </Field>
              <Field className="justify-end sm:col-span-2 lg:col-span-2 lg:items-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-fit"
                  onClick={clear}
                  disabled={!isFiltered}
                >
                  <FilterXIcon data-icon="inline-start" />
                  Clear filters
                </Button>
              </Field>
            </FieldGroup>
          </form>

          {filtered.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchXIcon />
                </EmptyMedia>
                <EmptyTitle>No matching transactions</EmptyTitle>
                <EmptyDescription>
                  {trades.length === 0
                    ? "There are no trades loaded."
                    : "No trade matches the current filters."}
                </EmptyDescription>
              </EmptyHeader>
              {isFiltered && (
                <EmptyContent>
                  <Button variant="outline" onClick={clear}>
                    <FilterXIcon data-icon="inline-start" />
                    Clear filters
                  </Button>
                </EmptyContent>
              )}
            </Empty>
          ) : (
            <>
              <Table>
                <TableCaption className="sr-only">
                  Transactions, {dir === "desc" ? "newest" : "oldest"} first.
                  Showing {start + 1} to {start + visible.length} of{" "}
                  {filtered.length}.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col" className={cn(STICKY_CELL, "px-2")}>
                      Trade ID
                    </TableHead>
                    <TableHead
                      scope="col"
                      aria-sort={dir === "asc" ? "ascending" : "descending"}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-2"
                        onClick={() => update({ dir: dir === "asc" ? "desc" : "asc" })}
                        title={`Sort ${dir === "asc" ? "newest" : "oldest"} first`}
                      >
                        Time (UTC)
                        {dir === "asc" ? (
                          <ArrowUpIcon data-icon="inline-end" />
                        ) : (
                          <ArrowDownIcon data-icon="inline-end" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead scope="col">Exchange</TableHead>
                    <TableHead scope="col">Asset</TableHead>
                    <TableHead scope="col">Side</TableHead>
                    <TableHead scope="col" className={NUM}>Quantity</TableHead>
                    <TableHead scope="col" className={NUM}>Price</TableHead>
                    <TableHead scope="col" className={NUM}>Gross value</TableHead>
                    <TableHead scope="col" className={NUM}>Fee</TableHead>
                    <TableHead scope="col" className={NUM}>Realized P&amp;L</TableHead>
                    <TableHead scope="col" className={NUM}>Avg cost after</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((t) => {
                    const effect = effects[t.tradeId]
                    return (
                      <TableRow key={t.tradeId}>
                        <TableHead scope="row" className={cn(STICKY_CELL, "px-2 font-mono text-xs")}>
                          {t.tradeId}
                        </TableHead>
                        <TableCell>{formatDateTimeUtc(t.timestamp)}</TableCell>
                        <TableCell>{t.exchange}</TableCell>
                        <TableCell className="font-medium">{t.symbol}</TableCell>
                        <TableCell>
                          <Badge variant={t.side === "BUY" ? "secondary" : "outline"}>
                            {t.side}
                          </Badge>
                        </TableCell>
                        <TableCell className={NUM}>{formatQuantity(t.quantity)}</TableCell>
                        <TableCell className={NUM}>{formatPrice(t.priceUsd)}</TableCell>
                        <TableCell className={NUM}>{formatUsd(t.grossValueUsd)}</TableCell>
                        <TableCell className={NUM}>{formatUsd(t.feeUsd)}</TableCell>
                        <TableCell className={NUM}>
                          {effect?.realizedPnl ? (
                            <PnlValue value={effect.realizedPnl} />
                          ) : (
                            <span className="text-muted-foreground">{EM_DASH}</span>
                          )}
                        </TableCell>
                        <TableCell className={NUM}>
                          {effect && effect.quantityAfter !== "0"
                            ? formatPrice(effect.avgCostAfter)
                            : EM_DASH}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  Showing {start + 1}–{start + visible.length} of {filtered.length}
                </p>
                <Pagination className="mx-0 w-auto justify-start sm:justify-end">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        aria-disabled={page <= 1}
                        tabIndex={page <= 1 ? -1 : undefined}
                        className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
                        onClick={(e) => {
                          e.preventDefault()
                          goTo(page - 1)
                        }}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <span className="px-2 text-sm tabular-nums" aria-live="polite">
                        Page {page} of {pageCount}
                      </span>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        aria-disabled={page >= pageCount}
                        tabIndex={page >= pageCount ? -1 : undefined}
                        className={page >= pageCount ? "pointer-events-none opacity-50" : undefined}
                        onClick={(e) => {
                          e.preventDefault()
                          goTo(page + 1)
                        }}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </>
          )}

          <p
            className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-sm tabular-nums"
            aria-live="polite"
          >
            <span>
              <span className="text-muted-foreground">Filtered trades: </span>
              <span className="font-medium">{filtered.length}</span>
            </span>
            <span>
              <span className="text-muted-foreground">Gross value: </span>
              <span className="font-medium">{formatUsd(totals.gross)}</span>
            </span>
            <span>
              <span className="text-muted-foreground">Fees: </span>
              <span className="font-medium">{formatUsd(totals.fees)}</span>
            </span>
          </p>
        </CardContent>
      </Card>
    </section>
  )
}
