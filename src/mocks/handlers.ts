import { delay, http, HttpResponse } from "msw"

import type { ApiError } from "@/domain/types"
import { currentCsv, getResponse, importCsv, resetToSample } from "@/mocks/db"

const LATENCY_MS = 250
const MAX_IMPORT_BYTES = 2 * 1024 * 1024

function errorResponse(status: number, body: ApiError) {
  return HttpResponse.json(body, { status })
}

/** Adds latency and turns unexpected throws into a generic 500 (no stack leaked). */
function guarded(
  action: string,
  resolver: (request: Request) => Promise<Response> | Response
) {
  return async ({ request }: { request: Request }) => {
    await delay(LATENCY_MS)
    try {
      return await resolver(request)
    } catch (error) {
      console.error(`[api] Internal error while ${action}`, error)
      return errorResponse(500, { error: `Internal error while ${action}.` })
    }
  }
}

export const handlers = [
  http.get(
    "/api/portfolio",
    guarded("loading the portfolio", () => HttpResponse.json(getResponse()))
  ),

  http.get(
    "/api/trades.csv",
    guarded(
      "exporting trades",
      () =>
        new HttpResponse(currentCsv(), {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="trades.csv"',
          },
        })
    )
  ),

  http.post(
    "/api/trades/import",
    guarded("importing trades", async (request) => {
      const declared = Number(request.headers.get("content-length"))
      const tooLarge = () =>
        errorResponse(413, {
          error: "File too large. The maximum size is 2 MB.",
        })
      if (Number.isFinite(declared) && declared > MAX_IMPORT_BYTES) {
        return tooLarge()
      }
      const text = await request.text()
      if (new Blob([text]).size > MAX_IMPORT_BYTES) return tooLarge()

      const result = importCsv(text)
      if (!result.ok) {
        const count = result.issues.length
        return errorResponse(422, {
          error: `Import rejected: ${count} issue${count === 1 ? "" : "s"} found. No data was changed.`,
          issues: result.issues,
        })
      }
      return HttpResponse.json(getResponse())
    })
  ),

  http.post(
    "/api/trades/reset",
    guarded("resetting the dataset", () => {
      resetToSample()
      return HttpResponse.json(getResponse())
    })
  ),

  http.all("/api/*", async () => {
    await delay(LATENCY_MS)
    return errorResponse(404, { error: "Not found." })
  }),
]
