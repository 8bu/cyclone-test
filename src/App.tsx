import { useEffect, useState } from "react"
import { AlertTriangleIcon, CheckCircle2Icon } from "lucide-react"

import { AllocationChart } from "@/components/app/allocation-chart"
import { AppHeader } from "@/components/app/app-header"
import { ErrorBoundary } from "@/components/app/error-boundary"
import { HoldingsTable } from "@/components/app/holdings-table"
import { ImportDialog } from "@/components/app/import-dialog"
import { PnlChart } from "@/components/app/pnl-chart"
import {
  ErrorState,
  LoadingState,
  MissingPricesAlert,
  NoTradesState,
} from "@/components/app/states"
import { SummaryCards } from "@/components/app/summary-cards"
import { TransactionsExplorer } from "@/components/app/transactions-explorer"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { usePortfolio } from "@/hooks/use-portfolio"

const NOTICE_MS = 6000

export function App() {
  const { status, data, error, busy, refetch, importCsv, reset } = usePortfolio()
  const [importOpen, setImportOpen] = useState(false)
  const [importedNotice, setImportedNotice] = useState(false)

  useEffect(() => {
    if (!importedNotice) return
    const timer = setTimeout(() => setImportedNotice(false), NOTICE_MS)
    return () => clearTimeout(timer)
  }, [importedNotice])

  const handleImported = () => {
    setImportOpen(false)
    setImportedNotice(true)
  }

  const handleReset = async () => {
    setImportedNotice(false)
    await reset()
  }

  const hasData = status === "ready" && data !== null

  return (
    <div className="min-h-svh bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <AppHeader
        source={hasData ? data.source : null}
        asOf={hasData ? (data.portfolio.asOf ?? data.prices?.asOf ?? null) : null}
        busy={busy}
        onImport={() => setImportOpen(true)}
        onReset={handleReset}
      />
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 px-4 py-6 outline-none sm:px-6"
      >
        {importedNotice && hasData && (
          <Alert>
            <CheckCircle2Icon />
            <AlertTitle>Import complete</AlertTitle>
            <AlertDescription>
              {data.trades.length} {data.trades.length === 1 ? "trade" : "trades"} loaded
              from your file.
            </AlertDescription>
          </Alert>
        )}
        {hasData && error && (
          <Alert variant="destructive">
            <AlertTriangleIcon />
            <AlertTitle>Something did not work</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <ErrorBoundary resetKey={data}>
          {status === "loading" && <LoadingState />}
          {status === "error" && (
            <ErrorState
              message={error ?? "The portfolio could not be loaded."}
              onRetry={() => void refetch()}
            />
          )}
          {hasData &&
            (data.trades.length === 0 && data.portfolio.holdings.length === 0 ? (
              <NoTradesState
                onImport={() => setImportOpen(true)}
                onReset={() => void handleReset()}
                busy={busy}
              />
            ) : (
              <>
                {data.portfolio.summary.missingPrices.length > 0 && (
                  <MissingPricesAlert symbols={data.portfolio.summary.missingPrices} />
                )}
                <SummaryCards summary={data.portfolio.summary} />
                <HoldingsTable
                  holdings={data.portfolio.holdings}
                  summary={data.portfolio.summary}
                />
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <AllocationChart
                    holdings={data.portfolio.holdings}
                    totalValue={data.portfolio.summary.portfolioValue}
                  />
                  <PnlChart holdings={data.portfolio.holdings} />
                </div>
                <TransactionsExplorer
                  trades={data.trades}
                  effects={data.portfolio.effects}
                />
              </>
            ))}
        </ErrorBoundary>
      </main>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        busy={busy}
        onImport={importCsv}
        onImported={handleImported}
      />
    </div>
  )
}

export default App
