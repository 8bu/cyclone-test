export interface CsvRecord {
  /** 1-based line number on which the record starts (header = 1). */
  line: number
  cells: string[]
}

/**
 * Minimal RFC 4180 parser: quoted fields (with "" escapes and embedded
 * newlines), CRLF / LF / CR line endings, a leading BOM. Completely blank
 * lines are skipped, but line numbers still count them.
 */
export function parseCsv(input: string): CsvRecord[] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input
  const records: CsvRecord[] = []

  let cells: string[] = []
  let field = ""
  let inQuotes = false
  let quotedField = false
  let line = 1
  let recordLine = 1

  const endField = () => {
    cells.push(field)
    field = ""
    quotedField = false
  }

  const endRecord = () => {
    const wasQuoted = quotedField
    endField()
    const blank = cells.length === 1 && cells[0].trim() === "" && !wasQuoted
    if (!blank) records.push({ line: recordLine, cells })
    cells = []
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        if (ch === "\n") line++
        field += ch
      }
      continue
    }

    if (ch === '"' && field === "") {
      inQuotes = true
      quotedField = true
    } else if (ch === ",") {
      endField()
    } else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i++
      endRecord()
      line++
      recordLine = line
    } else {
      field += ch
    }
  }

  if (field !== "" || cells.length > 0 || quotedField) endRecord()

  return records
}
