/// <reference types="vite/client" />

/** Failure/edge scenarios the E2E hook can install (see src/mocks/e2e.ts). */
type E2eScenario =
  | "portfolio-500"
  | "portfolio-network-error"
  | "portfolio-slow"
  | "portfolio-missing-prices"
  | "portfolio-corrupt-payload"
  | "reset-500"

/** Test-only API, present only when the app runs with `--mode e2e`. */
interface E2eHook {
  /** Installs MSW runtime handlers for the scenario. */
  simulate(name: E2eScenario): void
  /** Drops all runtime handlers, restoring the real API. */
  clear(): void
}

interface Window {
  __e2e?: E2eHook
}
