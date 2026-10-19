import { useState } from "react"
import { DownloadIcon, RotateCcwIcon, UploadIcon, XIcon } from "lucide-react"

import { SAMPLE_CSV_URL } from "@/api/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { formatDateTimeUtc } from "@/lib/format"

export function AppHeader({
  source,
  asOf,
  busy,
  onImport,
  onReset,
}: {
  source: "sample" | "imported" | null
  asOf: string | null
  busy: boolean
  onImport: () => void
  onReset: () => Promise<void>
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  const confirmReset = async () => {
    await onReset()
    setConfirmOpen(false)
  }

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:px-8">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-xl font-semibold tracking-tight">Portfolio analytics</h1>
          <div className="flex flex-wrap items-center gap-2">
            {asOf && <Badge variant="outline">Valued as of {formatDateTimeUtc(asOf)}</Badge>}
            {source && (
              <Badge variant="secondary">
                {source === "sample" ? "Sample data" : "Imported data"}
              </Badge>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:shrink-0 lg:justify-end">
          <Button
            onClick={onImport}
            disabled={busy}
            className="col-span-2 h-11 sm:col-span-1 sm:h-10 md:h-8"
          >
            <UploadIcon data-icon="inline-start" />
            Import trades.csv
          </Button>
          <Button
            variant="outline"
            onClick={() => setConfirmOpen(true)}
            disabled={busy}
            aria-label="Reset sample data"
            className="h-10 min-w-0 md:h-8"
          >
            {busy ? <Spinner data-icon="inline-start" /> : <RotateCcwIcon data-icon="inline-start" />}
            <span className="sm:hidden">Reset</span>
            <span className="hidden sm:inline">Reset sample data</span>
          </Button>
          <Button variant="outline" asChild className="h-10 min-w-0 md:h-8">
            <a href={SAMPLE_CSV_URL} download="trades.csv" aria-label="Download sample trades.csv">
              <DownloadIcon data-icon="inline-start" />
              <span className="sm:hidden">Sample CSV</span>
              <span className="hidden sm:inline">Download sample trades.csv</span>
            </a>
          </Button>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(next) => !busy && setConfirmOpen(next)}>
        <DialogContent showCloseButton={false} className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={busy}
              className="absolute top-1 right-1 size-10 md:top-2 md:right-2 md:size-7"
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
          <DialogHeader className="pr-10">
            <DialogTitle>Reset to sample data?</DialogTitle>
            <DialogDescription>
              This discards any imported trades and restores the bundled
              sample dataset.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={busy} className="h-10 md:h-8">
                Cancel
              </Button>
            </DialogClose>
            <Button onClick={confirmReset} disabled={busy} className="h-10 md:h-8">
              {busy ? <Spinner data-icon="inline-start" /> : <RotateCcwIcon data-icon="inline-start" />}
              Reset sample data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  )
}
