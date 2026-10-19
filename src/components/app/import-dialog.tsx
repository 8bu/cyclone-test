import { useState, type ChangeEvent, type FormEvent } from "react"
import { AlertTriangleIcon, UploadIcon } from "lucide-react"

import { SAMPLE_CSV_URL } from "@/api/client"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { TRADE_COLUMNS, type ImportIssue } from "@/domain/types"
import type { ImportOutcome } from "@/hooks/use-portfolio"

const MAX_ISSUES_SHOWN = 50

interface Failure {
  message: string
  issues: ImportIssue[]
}

function describeIssue(issue: ImportIssue) {
  return [issue.row === null ? "File" : `Row ${issue.row}`, issue.field, issue.message]
    .filter((part) => part !== null && part !== "")
    .join(" · ")
}

function ImportForm({
  busy,
  onImport,
  onImported,
}: {
  busy: boolean
  onImport: (text: string) => Promise<ImportOutcome>
  onImported: () => void
}) {
  const [text, setText] = useState("")
  const [fileName, setFileName] = useState<string | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setFailure(null)
    try {
      setText(await file.text())
      setFileName(file.name)
    } catch {
      setFailure({ message: `Could not read ${file.name}.`, issues: [] })
    }
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy || text.trim() === "") return
    setFailure(null)
    const outcome = await onImport(text)
    if (outcome.ok) onImported()
    else setFailure({ message: outcome.message, issues: outcome.issues })
  }

  const shown = failure?.issues.slice(0, MAX_ISSUES_SHOWN) ?? []
  const hidden = (failure?.issues.length ?? 0) - shown.length

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="import-file">CSV file</FieldLabel>
          <Input
            id="import-file"
            type="file"
            accept=".csv,text/csv"
            onChange={onFile}
            disabled={busy}
          />
          <FieldDescription>
            {fileName ? `Loaded ${fileName}. ` : ""}
            Required columns: <code>{TRADE_COLUMNS.join(", ")}</code>.{" "}
            <a href={SAMPLE_CSV_URL} download="trades.csv" className="underline underline-offset-3">
              Download sample
            </a>
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="import-text">Or paste CSV</FieldLabel>
          <Textarea
            id="import-text"
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setFileName(null)
            }}
            placeholder={TRADE_COLUMNS.join(",")}
            rows={6}
            className="font-mono text-xs"
            spellCheck={false}
            disabled={busy}
          />
          <FieldDescription>
            The whole file is validated first. If any row is invalid nothing is
            imported and your current data stays unchanged.
          </FieldDescription>
        </Field>
      </FieldGroup>

      {failure && (
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>
            {failure.issues.length > 0
              ? `${failure.issues.length} ${failure.issues.length === 1 ? "problem" : "problems"} found. Nothing was imported.`
              : "Import failed. Nothing was imported."}
          </AlertTitle>
          <AlertDescription>
            {failure.issues.length === 0 ? (
              <p>{failure.message}</p>
            ) : (
              <>
                <ul
                  role="region"
                  aria-label="Import problems"
                  tabIndex={0}
                  className="mt-1 flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border border-border p-2 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {shown.map((issue, i) => (
                    <li key={i} className="break-words">
                      {describeIssue(issue)}
                    </li>
                  ))}
                </ul>
                {hidden > 0 && (
                  <p className="mt-1 text-xs">
                    …and {hidden} more {hidden === 1 ? "problem" : "problems"} not shown.
                  </p>
                )}
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={busy}>
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={busy || text.trim() === ""}>
          {busy ? <Spinner data-icon="inline-start" /> : <UploadIcon data-icon="inline-start" />}
          Import trades
        </Button>
      </DialogFooter>
    </form>
  )
}

export function ImportDialog({
  open,
  onOpenChange,
  busy,
  onImport,
  onImported,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  busy: boolean
  onImport: (text: string) => Promise<ImportOutcome>
  onImported: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Import trades.csv</DialogTitle>
          <DialogDescription>
            Replace the current dataset with your own trades. Choose a file or
            paste its contents.
          </DialogDescription>
        </DialogHeader>
        <ImportForm busy={busy} onImport={onImport} onImported={onImported} />
      </DialogContent>
    </Dialog>
  )
}
