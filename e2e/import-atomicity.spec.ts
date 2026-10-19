import {
  csv,
  expect,
  expectSampleDashboard,
  expectTinyDashboard,
  getPortfolio,
  importDialog,
  importViaDialog,
  INVALID_CSV,
  issuesOf,
  openApp,
  postCsv,
  resetViaDialog,
  storedDataset,
  test,
  TINY_CSV,
} from "./fixtures"

test.describe("import is atomic", () => {
  test("an invalid file shows every problem and changes nothing", async ({
    page,
  }) => {
    await openApp(page)
    const before = await getPortfolio(page)

    const dialog = await importViaDialog(page, INVALID_CSV)

    const alert = dialog.getByRole("alert")
    await expect(alert).toContainText("3 problems found. Nothing was imported.")
    await expect(alert).toContainText(
      'Row 3 (T1): trade_id "T1" is already used on row 2.'
    )
    await expect(alert).toContainText(
      'Row 4 (T2): exchange "Kraken" is not supported.'
    )
    await expect(alert).toContainText(
      'Row 5 (T3): quantity "0" must be a number greater than 0.'
    )
    await expect(dialog).toBeVisible()

    await dialog.getByRole("button", { name: "Cancel" }).click()
    await expect(dialog).toBeHidden()

    await expectSampleDashboard(page)
    expect(await storedDataset(page)).toBeNull()
    expect(await getPortfolio(page)).toEqual(before)
  })

  test("a SELL dated before its BUY is rejected and nothing changes", async ({
    page,
  }) => {
    await openApp(page)
    const before = await getPortfolio(page)
    const text = csv(
      "B1,2026-02-01T00:00:00Z,Binance,BTC,BUY,1,100,0",
      "S1,2026-01-01T00:00:00Z,Binance,BTC,SELL,1,100,0"
    )

    const dialog = await importViaDialog(page, text)

    const alert = dialog.getByRole("alert")
    await expect(alert).toContainText("1 problem found. Nothing was imported.")
    await expect(alert).toContainText("Row 3 (S1): cannot SELL 1 BTC")
    await expect(alert).toContainText("only 0 BTC held at that point")
    await dialog.getByRole("button", { name: "Cancel" }).click()

    await expectSampleDashboard(page)
    expect(await storedDataset(page)).toBeNull()
    expect(await getPortfolio(page)).toEqual(before)

    const response = await postCsv(page, text)
    expect(response.status).toBe(422)
    expect(issuesOf(response).map((i) => i.code)).toEqual([
      "SELL_EXCEEDS_HOLDINGS",
    ])
  })

  // Known limitation: holdings are only replayed once every row is valid, so a
  // file with a bad row AND an oversized SELL reports the row problem only.
  test("a bad row hides the SELL-exceeds-holdings check", async ({ page }) => {
    await openApp(page)
    const text = csv(
      "B1,2026-01-01T00:00:00Z,Binance,BTC,BUY,1,100,0",
      "X1,2026-01-02T00:00:00Z,Binance,BTC,BUY,0,100,0",
      "S1,2026-01-03T00:00:00Z,Binance,BTC,SELL,5,100,0"
    )

    const response = await postCsv(page, text)
    expect(response.status).toBe(422)
    expect(issuesOf(response).map((i) => i.code)).toEqual(["INVALID_QUANTITY"])

    const dialog = await importViaDialog(page, text)
    const alert = dialog.getByRole("alert")
    await expect(alert).toContainText("1 problem found. Nothing was imported.")
    await expect(alert).toContainText(
      'Row 3 (X1): quantity "0" must be a number greater than 0.'
    )
    await expect(alert).not.toContainText("cannot SELL")
    await expect(alert).not.toContainText("Row 4")
    expect(await storedDataset(page)).toBeNull()
  })

  test("a valid import updates the dashboard, persists and survives a reload", async ({
    page,
  }) => {
    await openApp(page)

    const dialog = await importViaDialog(page, TINY_CSV)
    await expect(dialog).toBeHidden()
    await expect(
      page.getByText("3 trades loaded from your file.")
    ).toBeVisible()
    await expectTinyDashboard(page)

    expect(JSON.parse((await storedDataset(page)) ?? "null")).toEqual({
      csv: TINY_CSV,
    })

    await page.reload()
    await expectTinyDashboard(page)
    expect(JSON.parse((await storedDataset(page)) ?? "null")).toEqual({
      csv: TINY_CSV,
    })
    expect((await getPortfolio(page)).source).toBe("imported")
  })

  test("Reset sample data restores the 200 sample trades and clears storage", async ({
    page,
  }) => {
    await openApp(page)
    await expect(await importViaDialog(page, TINY_CSV)).toBeHidden()
    await expectTinyDashboard(page)
    expect(await storedDataset(page)).not.toBeNull()

    await resetViaDialog(page)

    await expectSampleDashboard(page)
    expect(await storedDataset(page)).toBeNull()
    expect((await getPortfolio(page)).trades).toHaveLength(200)

    await page.reload()
    await expectSampleDashboard(page)
  })

  test("a failed import after a successful one keeps the imported dataset", async ({
    page,
  }) => {
    await openApp(page)
    await expect(await importViaDialog(page, TINY_CSV)).toBeHidden()
    await expectTinyDashboard(page)
    const before = await getPortfolio(page)

    const dialog = await importViaDialog(page, INVALID_CSV)
    await expect(dialog.getByRole("alert")).toContainText(
      "3 problems found. Nothing was imported."
    )
    await dialog.getByRole("button", { name: "Cancel" }).click()
    await expect(importDialog(page)).toBeHidden()

    await expectTinyDashboard(page)
    expect(JSON.parse((await storedDataset(page)) ?? "null")).toEqual({
      csv: TINY_CSV,
    })
    expect(await getPortfolio(page)).toEqual(before)
  })
})
