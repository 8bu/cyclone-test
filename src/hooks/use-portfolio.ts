import { useCallback, useEffect, useRef, useState } from "react"

import {
  ApiRequestError,
  fetchPortfolio,
  importTrades,
  resetSample,
} from "@/api/client"
import type { ImportIssue, PortfolioResponse } from "@/domain/types"

export type ImportOutcome =
  | { ok: true }
  | { ok: false; message: string; issues: ImportIssue[] }

export interface UsePortfolio {
  /**
   * "error" only while there is no data to show. If a later refetch/reset
   * fails, status stays "ready", `data` is kept and `error` carries the message.
   */
  status: "loading" | "error" | "ready"
  data: PortfolioResponse | null
  error: string | null
  /** True while an import or reset is in flight. */
  busy: boolean
  refetch(): Promise<void>
  importCsv(text: string): Promise<ImportOutcome>
  reset(): Promise<void>
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong."
}

export function usePortfolio(): UsePortfolio {
  const [data, setData] = useState<PortfolioResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const mounted = useRef(false)
  const dataRef = useRef<PortfolioResponse | null>(null)
  // Bumped by every operation that writes data; older results are ignored.
  const generation = useRef(0)

  const commit = useCallback((next: PortfolioResponse) => {
    dataRef.current = next
    setData(next)
    setError(null)
    setLoading(false)
  }, [])

  const fail = useCallback((message: string) => {
    setError(message)
    setLoading(false)
  }, [])

  const refetch = useCallback(async () => {
    const id = ++generation.current
    if (dataRef.current === null) setLoading(true)
    try {
      const next = await fetchPortfolio()
      if (mounted.current && id === generation.current) commit(next)
    } catch (e) {
      if (mounted.current && id === generation.current) fail(messageOf(e))
    }
  }, [commit, fail])

  const importCsv = useCallback(
    async (text: string): Promise<ImportOutcome> => {
      const id = ++generation.current
      setBusy(true)
      try {
        const next = await importTrades(text)
        if (mounted.current && id === generation.current) commit(next)
        return { ok: true }
      } catch (e) {
        return {
          ok: false,
          message: messageOf(e),
          issues: e instanceof ApiRequestError ? e.issues : [],
        }
      } finally {
        if (mounted.current) setBusy(false)
      }
    },
    [commit]
  )

  const reset = useCallback(async () => {
    const id = ++generation.current
    setBusy(true)
    try {
      const next = await resetSample()
      if (mounted.current && id === generation.current) commit(next)
    } catch (e) {
      if (mounted.current && id === generation.current) fail(messageOf(e))
    } finally {
      if (mounted.current) setBusy(false)
    }
  }, [commit, fail])

  useEffect(() => {
    mounted.current = true
    const id = ++generation.current
    fetchPortfolio().then(
      (next) => {
        if (mounted.current && id === generation.current) commit(next)
      },
      (e: unknown) => {
        if (mounted.current && id === generation.current) fail(messageOf(e))
      }
    )
    return () => {
      mounted.current = false
    }
  }, [commit, fail])

  const status: UsePortfolio["status"] =
    data !== null ? "ready" : loading ? "loading" : "error"

  return { status, data, error, busy, refetch, importCsv, reset }
}
