import { useState } from "react"
import { DownloadIcon, RotateCcwIcon, UploadIcon } from "lucide-react"

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
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
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
        <div className="flex flex-wrap gap-2">
          <Button onClick={onImport} disabled={busy}>
            <UploadIcon data-icon="inline-start" />
            Import trades.csv
          </Button>
          <Button variant="outline" onClick={() => setConfirmOpen(true)} disabled={busy}>
            {busy ? <Spinner data-icon="inline-start" /> : <RotateCcwIcon data-icon="inline-start" />}
            Reset sample data
          </Button>
          <Button variant="outline" asChild>
            <a href={SAMPLE_CSV_URL} download="trades.csv">
              <DownloadIcon data-icon="inline-start" />
              Download sample trades.csv
            </a>
          </Button>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(next) => !busy && setConfirmOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset to sample data?</DialogTitle>
            <DialogDescription>
              This discards any imported trades and restores the bundled
              sample dataset.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={busy}>
                Cancel
              </Button>
            </DialogClose>
            <Button onClick={confirmReset} disabled={busy}>
              {busy ? <Spinner data-icon="inline-start" /> : <RotateCcwIcon data-icon="inline-start" />}
              Reset sample data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  )
}
