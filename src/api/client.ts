import type { ApiError, ImportIssue, PortfolioResponse } from "@/domain/types"

/** GET returns the CURRENT dataset as text/csv. */
export const SAMPLE_CSV_URL = "/api/trades.csv"

export class ApiRequestError extends Error {
  status: number
  issues: ImportIssue[]

  constructor(status: number, message: string, issues: ImportIssue[] = []) {
    super(message)
    this.name = "ApiRequestError"
    this.status = status
    this.issues = issues
  }
}

function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
  )
}

async function request(
  url: string,
  init?: RequestInit
): Promise<PortfolioResponse> {
  let response: Response
  try {
    response = await fetch(url, init)
  } catch {
    throw new ApiRequestError(
      0,
      "Could not reach the API. Check your connection and try again."
    )
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new ApiRequestError(
      response.ok ? 0 : response.status,
      response.ok
        ? "The API returned an unreadable response."
        : `Request failed (HTTP ${response.status}).`
    )
  }

  if (!response.ok) {
    if (isApiError(body)) {
      throw new ApiRequestError(response.status, body.error, body.issues ?? [])
    }
    throw new ApiRequestError(
      response.status,
      `Request failed (HTTP ${response.status}).`
    )
  }
  return body as PortfolioResponse
}

export function fetchPortfolio(): Promise<PortfolioResponse> {
  return request("/api/portfolio")
}

export function importTrades(csvText: string): Promise<PortfolioResponse> {
  return request("/api/trades/import", {
    method: "POST",
    headers: { "Content-Type": "text/csv" },
    body: csvText,
  })
}

export function resetSample(): Promise<PortfolioResponse> {
  return request("/api/trades/reset", { method: "POST" })
}
