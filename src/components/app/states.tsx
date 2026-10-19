import { AlertTriangleIcon, InboxIcon, RotateCcwIcon, UploadIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import type { AssetSymbol } from "@/domain/types"

export function LoadingState() {
  return (
    <div
      className="flex flex-col gap-6 md:gap-8"
      role="status"
      aria-busy="true"
      aria-label="Loading portfolio"
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Card key={i} size="sm" className="min-w-0">
            <CardHeader>
              <Skeleton className="h-4 w-full max-w-28" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Skeleton className="h-6 w-full max-w-40 sm:h-7 lg:h-8" />
              <Skeleton className="h-3 w-full max-w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-6 md:gap-8 lg:grid-cols-2">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  )
}

export function ErrorState({
  message,
  onRetry,
  busy = false,
}: {
  message: string
  onRetry: () => void
  busy?: boolean
}) {
  return (
    <Alert variant="destructive">
      <AlertTriangleIcon />
      <AlertTitle>Could not load the portfolio</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={busy}
            className="h-11 w-full sm:h-10 sm:w-auto md:h-7"
          >
            {busy ? <Spinner data-icon="inline-start" /> : <RotateCcwIcon data-icon="inline-start" />}
            Retry
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}

export function NoTradesState({
  onImport,
  onReset,
  busy,
}: {
  onImport: () => void
  onReset: () => void
  busy: boolean
}) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <InboxIcon />
        </EmptyMedia>
        <EmptyTitle>No trades loaded</EmptyTitle>
        <EmptyDescription>
          Import a trades.csv file to see holdings, P&amp;L and allocation, or
          restore the bundled sample data.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
          <Button onClick={onImport} disabled={busy} className="h-11 sm:h-10 md:h-8">
            <UploadIcon data-icon="inline-start" />
            Import trades.csv
          </Button>
          <Button variant="outline" onClick={onReset} disabled={busy} className="h-11 sm:h-10 md:h-8">
            {busy ? <Spinner data-icon="inline-start" /> : <RotateCcwIcon data-icon="inline-start" />}
            Reset sample data
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  )
}

export function NoPositionsState() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <InboxIcon />
        </EmptyMedia>
        <EmptyTitle>No open or realized positions</EmptyTitle>
        <EmptyDescription>
          The loaded trades do not leave any holding or realized result to
          show.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export function MissingPricesAlert({ symbols }: { symbols: AssetSymbol[] }) {
  return (
    <Alert>
      <AlertTriangleIcon />
      <AlertTitle>
        Missing price{symbols.length === 1 ? "" : "s"}: {symbols.join(", ")}
      </AlertTitle>
      <AlertDescription>
        No price is available for {symbols.join(", ")}, so{" "}
        {symbols.length === 1 ? "this asset is" : "these assets are"} excluded
        from portfolio value, unrealized P&amp;L, total P&amp;L and allocation.
        Cost basis and realized P&amp;L still include them.
      </AlertDescription>
    </Alert>
  )
}
