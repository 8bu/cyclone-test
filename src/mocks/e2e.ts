import { delay, http, HttpResponse } from "msw"
import type { SetupWorker } from "msw/browser"

import { computePortfolio } from "@/domain/portfolio"
import { getResponse } from "@/mocks/db"
import { guarded } from "@/mocks/handlers"

const SLOW_MS = 2500

function handlersFor(name: E2eScenario) {
  switch (name) {
    case "portfolio-500":
      return [
        http.get(
          "/api/portfolio",
          guarded("loading the portfolio", () => {
            throw new Error("Simulated portfolio failure")
          })
        ),
      ]

    case "portfolio-network-error":
      return [http.get("/api/portfolio", () => HttpResponse.error())]

    case "portfolio-slow":
      return [
        http.get("/api/portfolio", async () => {
          await delay(SLOW_MS)
          return HttpResponse.json(getResponse())
        }),
      ]

    case "portfolio-missing-prices":
      return [
        http.get(
          "/api/portfolio",
          guarded("loading the portfolio", () => {
            const real = getResponse()
            const prices = real.prices && {
              ...real.prices,
              prices: { ...real.prices.prices },
            }
            if (prices) delete prices.prices.BTC
            return HttpResponse.json({
              ...real,
              prices,
              portfolio: computePortfolio(real.trades, prices),
            })
          })
        ),
      ]

    case "portfolio-corrupt-payload":
      // Keeps `summary` intact (App reads it above the error boundary) and
      // corrupts `holdings`, which only child components read.
      return [
        http.get(
          "/api/portfolio",
          guarded("loading the portfolio", () => {
            const real = getResponse()
            return HttpResponse.json({
              ...real,
              portfolio: { ...real.portfolio, holdings: [null] },
            })
          })
        ),
      ]

    case "reset-500":
      return [
        http.post(
          "/api/trades/reset",
          guarded("resetting the dataset", () => {
            throw new Error("Simulated reset failure")
          })
        ),
      ]

    default:
      throw new Error(`Unknown E2E scenario: ${String(name)}`)
  }
}

/**
 * Installs `window.__e2e` (E2E mode only; see main.tsx). A `?e2e=<scenario>`
 * query parameter simulates that scenario before the app renders.
 */
export function installE2eHook(worker: SetupWorker): void {
  const hook: E2eHook = {
    simulate: (name) => worker.use(...handlersFor(name)),
    clear: () => worker.resetHandlers(),
  }
  window.__e2e = hook

  const scenario = new URLSearchParams(window.location.search).get("e2e")
  if (scenario) hook.simulate(scenario as E2eScenario)
}
