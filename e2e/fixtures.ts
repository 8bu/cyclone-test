import { expect, test, type Locator, type Page } from "@playwright/test"

export { expect, test }

/** localStorage key of an imported dataset (value: JSON `{ csv }`). */
export const STORAGE_KEY = "cyclone.trades.v1"

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024

export const HEADER =
  "trade_id,timestamp,exchange,symbol,side,quantity,price_usd,fee_usd"

/** Builds a CSV file text: the header followed by `rows`, newline terminated. */
export function csv(...rows: string[]): string {
  return [HEADER, ...rows].join("\n") + "\n"
}

/** Three problems: duplicate trade_id, unsupported exchange, zero quantity. */
export const INVALID_CSV = csv(
  "T1,2026-01-01T00:00:00Z,Binance,BTC,BUY,1,100,0",
  "T1,2026-01-02T00:00:00Z,Binance,BTC,BUY,1,100,0",
  "T2,2026-01-03T00:00:00Z,Kraken,ETH,BUY,1,100,0",
  "T3,2026-01-04T00:00:00Z,Binance,SOL,BUY,0,100,0"
)

/**
 * Hand-checked dataset (prices: BTC 111500, ETH 4025).
 * BTC: BUY 1 @ 100000 + 10 fee -> cost 100010; SELL 0.5 @ 110000 - 5 fee ->
 * proceeds 54995, cost removed 50005, realized 4990; 0.5 BTC left (cost 50005,
 * value 55750). ETH: 2 @ 4000 -> cost 8000, value 8050.
 * Value 63800, cost 58005, realized 4990, unrealized 5795, total 10785, fees 15.
 */
export const TINY_CSV = csv(
  "T1,2026-01-01T00:00:00Z,Binance,BTC,BUY,1,100000,10",
  "T2,2026-01-02T00:00:00Z,Binance,BTC,SELL,0.5,110000,5",
  "T3,2026-01-03T00:00:00Z,Coinbase,ETH,BUY,2,4000,0"
)

const MINUS = "\u2212"

/** Loads `/` (optionally with a boot scenario) without waiting for the data. */
export async function gotoApp(page: Page, scenario?: E2eScenario) {
  await page.goto(scenario ? `/?e2e=${scenario}` : "/")
}

export async function waitForDashboard(page: Page) {
  await expect(page.getByText("Portfolio value", { exact: true })).toBeVisible()
}

/** Opens the app and waits until the summary cards are visible. */
export async function openApp(page: Page) {
  await gotoApp(page)
  await waitForDashboard(page)
}

export async function simulate(page: Page, name: E2eScenario) {
  await page.evaluate((scenario) => {
    if (!window.__e2e) throw new Error("window.__e2e is missing (--mode e2e)")
    window.__e2e.simulate(scenario)
  }, name)
}

export async function clearSimulation(page: Page) {
  await page.evaluate(() => {
    if (!window.__e2e) throw new Error("window.__e2e is missing (--mode e2e)")
    window.__e2e.clear()
  })
}

export interface ApiResponse {
  status: number
  headers: Record<string, string>
  text: string
  /** Parsed body, or null when the body is not JSON. */
  json: unknown
}

/** Calls the real MSW handlers with a fetch from the app origin. */
export async function api(
  page: Page,
  path: string,
  init: { method?: string; body?: string; contentType?: string } = {}
): Promise<ApiResponse> {
  return page.evaluate(
    async ({ path, init }) => {
      const response = await fetch(path, {
        method: init.method ?? "GET",
        headers: init.contentType ? { "Content-Type": init.contentType } : {},
        body: init.body,
      })
      const headers: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        headers[key] = value
      })
      const text = await response.text()
      let json: unknown = null
      try {
        json = JSON.parse(text)
      } catch {
        // not JSON (e.g. the CSV export)
      }
      return { status: response.status, headers, text, json }
    },
    { path, init }
  )
}

export function postCsv(page: Page, text: string) {
  return api(page, "/api/trades/import", {
    method: "POST",
    body: text,
    contentType: "text/csv",
  })
}

export interface PortfolioJson {
  source: "sample" | "imported"
  trades: { tradeId: string }[]
  portfolio: { summary: { portfolioValue: string; tradeCount: number } }
}

export async function getPortfolio(page: Page): Promise<PortfolioJson> {
  const response = await api(page, "/api/portfolio")
  expect(response.status).toBe(200)
  return response.json as PortfolioJson
}

/** Raw `localStorage` value of the imported dataset (null when absent). */
export function storedDataset(page: Page): Promise<string | null> {
  return page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY)
}

export function importButton(page: Page): Locator {
  return page
    .getByRole("banner")
    .getByRole("button", { name: "Import trades.csv" })
}

export function importDialog(page: Page): Locator {
  return page.getByRole("dialog", { name: "Import trades.csv" })
}

/** Opens the Import dialog, pastes `csvText` and submits. Returns the dialog. */
export async function importViaDialog(page: Page, csvText: string) {
  await importButton(page).click()
  const dialog = importDialog(page)
  await dialog.getByLabel("Or paste CSV").fill(csvText)
  await dialog
    .getByRole("button", { name: "Import trades", exact: true })
    .click()
  return dialog
}

/** Header "Reset sample data" button, then confirms in the dialog. */
export async function resetViaDialog(page: Page) {
  await page
    .getByRole("banner")
    .getByRole("button", { name: "Reset sample data" })
    .click()
  const dialog = page.getByRole("dialog", { name: "Reset to sample data?" })
  await dialog.getByRole("button", { name: "Reset sample data" }).click()
  await expect(dialog).toBeHidden()
}

/** One of the six summary cards, by its label. */
export function summaryCard(page: Page, label: string): Locator {
  return page.locator('[data-slot="card"]').filter({
    has: page
      .locator('[data-slot="card-description"]')
      .filter({ hasText: new RegExp(`^${label}$`) }),
  })
}

/** Section of the dashboard by the id of its heading (e.g. "holdings-heading"). */
export function section(page: Page, headingId: string): Locator {
  return page.locator(`section[aria-labelledby="${headingId}"]`)
}

/** Sample dataset: 200 trades from problems/trades.csv + prices.csv. */
export async function expectSampleDashboard(page: Page) {
  await expect(summaryCard(page, "Portfolio value")).toContainText("$60,620.89")
  await expect(summaryCard(page, "Cost basis")).toContainText("$59,969.24")
  await expect(summaryCard(page, "Realized P&L")).toContainText(
    `${MINUS}$5,052.96`
  )
  await expect(summaryCard(page, "Unrealized P&L")).toContainText("+$651.65")
  await expect(summaryCard(page, "Total P&L")).toContainText(
    `${MINUS}$4,401.31`
  )
  await expect(summaryCard(page, "Total fees")).toContainText("$2,708.86")
  await expect(page.getByText("Across 200 trades")).toBeVisible()
  await expect(page.getByText("Sample data", { exact: true })).toBeVisible()
  await expect(page.getByText("Imported data", { exact: true })).toHaveCount(0)
}

/** Dataset of `TINY_CSV` (3 trades). */
export async function expectTinyDashboard(page: Page) {
  await expect(summaryCard(page, "Portfolio value")).toContainText("$63,800.00")
  await expect(summaryCard(page, "Cost basis")).toContainText("$58,005.00")
  await expect(summaryCard(page, "Realized P&L")).toContainText("+$4,990.00")
  await expect(summaryCard(page, "Unrealized P&L")).toContainText("+$5,795.00")
  await expect(summaryCard(page, "Total P&L")).toContainText("+$10,785.00")
  await expect(summaryCard(page, "Total fees")).toContainText("$15.00")
  await expect(page.getByText("Across 3 trades")).toBeVisible()
  await expect(page.getByText("Imported data", { exact: true })).toBeVisible()
  await expect(page.getByText("Sample data", { exact: true })).toHaveCount(0)
}

export interface ImportIssueJson {
  row: number | null
  code: string
  message: string
}

/** `issues[]` of a 422 import response (throws when the body has none). */
export function issuesOf(response: ApiResponse): ImportIssueJson[] {
  const body = response.json
  if (
    typeof body === "object" &&
    body !== null &&
    "issues" in body &&
    Array.isArray(body.issues)
  ) {
    return body.issues
  }
  throw new Error(`Response has no issues[]: ${response.text.slice(0, 200)}`)
}
