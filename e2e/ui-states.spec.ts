import {
  clearSimulation,
  csv,
  expect,
  expectSampleDashboard,
  expectTinyDashboard,
  gotoApp,
  importViaDialog,
  openApp,
  resetViaDialog,
  section,
  simulate,
  storedDataset,
  summaryCard,
  test,
  TINY_CSV,
  waitForDashboard,
} from "./fixtures"

const MINUS = "\u2212"

test.describe("loading", () => {
  test("shows skeleton placeholders until the portfolio arrives", async ({
    page,
  }) => {
    await gotoApp(page, "portfolio-slow")

    const loading = page.getByRole("status", { name: "Loading portfolio" })
    await expect(loading).toBeVisible()
    await expect(
      loading.locator('[data-slot="skeleton"]').first()
    ).toBeVisible()
    await expect(
      page.getByText("Portfolio value", { exact: true })
    ).toBeHidden()

    await waitForDashboard(page)
    await expect(loading).toBeHidden()
    await expectSampleDashboard(page)
  })
})

test.describe("API errors on load", () => {
  const scenarios = [
    ["portfolio-500", "Internal error while loading the portfolio."],
    [
      "portfolio-network-error",
      "Could not reach the API. Check your connection and try again.",
    ],
  ] as const

  for (const [scenario, message] of scenarios) {
    test(`${scenario}: shows the error with Retry, then recovers`, async ({
      page,
    }) => {
      await gotoApp(page, scenario)

      const alert = page.getByRole("alert")
      await expect(alert).toContainText("Could not load the portfolio")
      await expect(alert).toContainText(message)
      await expect(
        page.getByRole("heading", { name: "Portfolio analytics" })
      ).toBeVisible()
      await expect(
        page.getByText("Portfolio value", { exact: true })
      ).toBeHidden()

      await clearSimulation(page)
      await alert.getByRole("button", { name: "Retry" }).click()

      await waitForDashboard(page)
      await expect(alert).toBeHidden()
      await expectSampleDashboard(page)
    })
  }
})

test.describe("empty and degenerate datasets", () => {
  test("a header-only import shows the empty state; Reset restores the sample", async ({
    page,
  }) => {
    await openApp(page)

    await expect(await importViaDialog(page, csv())).toBeHidden()

    await expect(page.getByText("No trades loaded")).toBeVisible()
    const main = page.getByRole("main")
    await expect(
      main.getByRole("button", { name: "Import trades.csv" })
    ).toBeVisible()
    await expect(
      main.getByRole("button", { name: "Reset sample data" })
    ).toBeVisible()
    await expect(
      page.getByText("Portfolio value", { exact: true })
    ).toBeHidden()
    await expect(page.getByText("Imported data", { exact: true })).toBeVisible()

    await main.getByRole("button", { name: "Reset sample data" }).click()

    await expectSampleDashboard(page)
    await expect(page.getByText("No trades loaded")).toBeHidden()
  })

  test("trades that leave nothing held show the empty holdings and chart states", async ({
    page,
  }) => {
    await openApp(page)
    const text = csv(
      "B1,2026-01-01T00:00:00Z,Binance,BTC,BUY,1,100,0",
      "S1,2026-01-02T00:00:00Z,Binance,BTC,SELL,1,100,0"
    )

    await expect(await importViaDialog(page, text)).toBeHidden()

    await expect(page.getByText("No trades loaded")).toBeHidden()
    await expect(page.getByText("Across 2 trades")).toBeVisible()
    await expect(summaryCard(page, "Portfolio value")).toContainText("$0.00")
    await expect(summaryCard(page, "Cost basis")).toContainText("$0.00")
    await expect(summaryCard(page, "Realized P&L")).toContainText("$0.00")
    await expect(summaryCard(page, "Realized P&L")).not.toContainText("+")
    await expect(summaryCard(page, "Realized P&L")).not.toContainText(MINUS)
    await expect(summaryCard(page, "Unrealized P&L")).toContainText(
      "No cost basis to compare against"
    )
    await expect(section(page, "holdings-heading")).toContainText(
      "No open or realized positions"
    )
    await expect(section(page, "allocation-heading")).toContainText(
      "No priced holdings"
    )
    await expect(section(page, "pnl-heading")).toContainText("No P&L to show")
  })
})

test.describe("missing prices", () => {
  test("an asset without a price is flagged and excluded from the totals", async ({
    page,
  }) => {
    await gotoApp(page, "portfolio-missing-prices")
    await waitForDashboard(page)

    const warning = page.getByRole("alert").filter({ hasText: "Missing price" })
    await expect(warning).toContainText("Missing price: BTC")
    await expect(warning).toContainText("No price is available for BTC")

    // Exact: 60620.89161 - 8633.3558 (BTC) = 51987.53581, displayed as $51,987.54.
    await expect(summaryCard(page, "Portfolio value")).toContainText(
      "$51,987.54"
    )
    await expect(summaryCard(page, "Portfolio value")).toContainText(
      "Excludes assets without a price"
    )
    await expect(summaryCard(page, "Cost basis")).toContainText("$59,969.24")
    await expect(summaryCard(page, "Realized P&L")).toContainText(
      `${MINUS}$5,052.96`
    )
    await expect(summaryCard(page, "Total fees")).toContainText("$2,708.86")

    const holdings = section(page, "holdings-heading")
    const btc = holdings.getByRole("row", { name: /^BTC\b/ })
    await expect(btc).toContainText("No price")
    await expect(btc).toContainText("—")
    await expect(
      holdings.getByRole("row").filter({ hasText: "No price" })
    ).toHaveCount(1)
    for (const symbol of ["ETH", "SOL", "CKB", "DOGE"]) {
      const row = holdings.getByRole("row", {
        name: new RegExp(`^${symbol}\\b`),
      })
      await expect(row).toBeVisible()
      await expect(row).not.toContainText("No price")
    }
  })
})

test.describe("error boundary", () => {
  test("a payload that breaks rendering shows the fallback, not a blank page", async ({
    page,
  }) => {
    await gotoApp(page, "portfolio-corrupt-payload")

    await expect(page.getByText("Something went wrong")).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Reload page" })
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Portfolio analytics" })
    ).toBeVisible()
    await expect(
      page.getByText("Portfolio value", { exact: true })
    ).toBeHidden()
  })
})

test.describe("failed reset", () => {
  test("keeps the current dataset and shows the error", async ({ page }) => {
    await openApp(page)
    await expect(await importViaDialog(page, TINY_CSV)).toBeHidden()
    await expectTinyDashboard(page)

    await simulate(page, "reset-500")
    await resetViaDialog(page)

    const alert = page
      .getByRole("alert")
      .filter({ hasText: "Something did not work" })
    await expect(alert).toContainText(
      "Internal error while resetting the dataset."
    )
    await expectTinyDashboard(page)
    expect(JSON.parse((await storedDataset(page)) ?? "null")).toEqual({
      csv: TINY_CSV,
    })
    await expect(
      page
        .getByRole("banner")
        .getByRole("button", { name: "Reset sample data" })
    ).toBeEnabled()

    await clearSimulation(page)
    await resetViaDialog(page)

    await expectSampleDashboard(page)
    await expect(alert).toBeHidden()
    expect(await storedDataset(page)).toBeNull()
  })
})
