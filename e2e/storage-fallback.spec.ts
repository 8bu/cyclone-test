import {
  csv,
  expect,
  expectSampleDashboard,
  expectTinyDashboard,
  getPortfolio,
  importViaDialog,
  openApp,
  STORAGE_KEY,
  test,
  TINY_CSV,
  waitForDashboard,
} from "./fixtures"

const STORED_VALUES = [
  ["non-JSON text", "this is {not json"],
  ["JSON without csv", JSON.stringify({ rows: 3 })],
  [
    "a csv that fails validation",
    JSON.stringify({ csv: csv("T1,not-a-date,Binance,BTC,BUY,1,100,0") }),
  ],
] as const

test.describe("localStorage fallback", () => {
  for (const [name, stored] of STORED_VALUES) {
    test(`boots with the sample when the key holds ${name}`, async ({
      page,
    }) => {
      await page.addInitScript(
        ([key, value]) => window.localStorage.setItem(key, value),
        [STORAGE_KEY, stored]
      )

      await openApp(page)

      await expectSampleDashboard(page)
      const portfolio = await getPortfolio(page)
      expect(portfolio.source).toBe("sample")
      expect(portfolio.trades).toHaveLength(200)
    })
  }

  test("works in memory when the dataset key cannot be read or written", async ({
    page,
  }) => {
    // Storage "unavailable" for the dataset key only: the theme provider reads
    // and writes its own key unguarded, so a blanket failure would not reach
    // the dataset code under test.
    await page.addInitScript((key) => {
      for (const method of ["getItem", "setItem", "removeItem"] as const) {
        const original = Storage.prototype[method] as (
          this: Storage,
          ...args: string[]
        ) => unknown
        Storage.prototype[method] = function (
          this: Storage,
          name: string,
          ...rest: string[]
        ) {
          if (name === key) {
            throw new DOMException("Storage unavailable", "SecurityError")
          }
          return original.call(this, name, ...rest)
        } as never
      }
    }, STORAGE_KEY)

    await openApp(page)
    await expectSampleDashboard(page)

    const dialog = await importViaDialog(page, TINY_CSV)

    await expect(dialog).toBeHidden()
    await expectTinyDashboard(page)
    await expect(page.getByText("Something did not work")).toHaveCount(0)
    expect((await getPortfolio(page)).source).toBe("imported")

    // Nothing was persisted, so a new page load starts from the sample again.
    await page.reload()
    await waitForDashboard(page)
    await expectSampleDashboard(page)
  })
})
