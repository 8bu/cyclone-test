import {
  api,
  clearSimulation,
  csv,
  expect,
  getPortfolio,
  HEADER,
  INVALID_CSV,
  issuesOf,
  MAX_IMPORT_BYTES,
  openApp,
  postCsv,
  simulate,
  storedDataset,
  test,
  TINY_CSV,
} from "./fixtures"

test.describe("API responses", () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
  })

  test("413 for a body of 2 MB + 1 byte, state unchanged", async ({ page }) => {
    const before = await getPortfolio(page)

    const response = await postCsv(page, "a".repeat(MAX_IMPORT_BYTES + 1))

    expect(response.status).toBe(413)
    expect(response.json).toEqual({
      error: "File too large. The maximum size is 2 MB.",
    })
    expect(await getPortfolio(page)).toEqual(before)
    expect(await storedDataset(page)).toBeNull()
  })

  test("a body of exactly 2 MB is parsed, not size-rejected", async ({
    page,
  }) => {
    const response = await postCsv(page, "a".repeat(MAX_IMPORT_BYTES))

    expect(response.status).toBe(422)
    expect(issuesOf(response).map((i) => i.code)).toContain("MISSING_COLUMN")
  })

  test("422 lists every issue with row, code and message", async ({ page }) => {
    const before = await getPortfolio(page)

    const response = await postCsv(page, INVALID_CSV)

    expect(response.status).toBe(422)
    expect(response.json).toMatchObject({
      error: "Import rejected: 3 issues found. No data was changed.",
    })
    const issues = issuesOf(response)
    expect(issues).toHaveLength(3)
    expect(issues).toMatchObject([
      { row: 3, code: "DUPLICATE_TRADE_ID" },
      { row: 4, code: "UNSUPPORTED_EXCHANGE" },
      { row: 5, code: "INVALID_QUANTITY" },
    ])
    for (const issue of issues) expect(issue.message).toMatch(/^Row \d+/)
    expect(await getPortfolio(page)).toEqual(before)
  })

  test("422 uses the singular for one issue and reports an empty file", async ({
    page,
  }) => {
    const badTimestamp = await postCsv(
      page,
      csv("T1,not-a-date,Binance,BTC,BUY,1,100,0")
    )
    expect(badTimestamp.status).toBe(422)
    expect(badTimestamp.json).toMatchObject({
      error: "Import rejected: 1 issue found. No data was changed.",
    })
    expect(issuesOf(badTimestamp)).toMatchObject([
      { row: 2, code: "INVALID_TIMESTAMP" },
    ])

    const empty = await postCsv(page, "")
    expect(empty.status).toBe(422)
    expect(issuesOf(empty)).toMatchObject([{ row: null, code: "EMPTY_FILE" }])
  })

  test("404 for unknown API routes", async ({ page }) => {
    for (const method of ["GET", "POST"]) {
      const response = await api(page, "/api/does-not-exist", { method })
      expect(response.status).toBe(404)
      expect(response.json).toEqual({ error: "Not found." })
    }
  })

  test("500 is a generic message without a stack", async ({ page }) => {
    await simulate(page, "portfolio-500")

    const response = await api(page, "/api/portfolio")

    expect(response.status).toBe(500)
    expect(response.json).toEqual({
      error: "Internal error while loading the portfolio.",
    })
    expect(response.text).not.toContain("Simulated")
    expect(response.text).not.toContain("stack")
    expect(response.text).not.toMatch(/\bat \S+:\d+/)

    await clearSimulation(page)
    expect((await api(page, "/api/portfolio")).status).toBe(200)
  })

  test("GET /api/trades.csv exports the sample and then the imported CSV", async ({
    page,
  }) => {
    const sample = await api(page, "/api/trades.csv")

    expect(sample.status).toBe(200)
    expect(sample.headers["content-type"]).toMatch(/^text\/csv/)
    expect(sample.headers["content-disposition"]).toContain("trades.csv")
    expect(sample.text.split("\n")[0]).toBe(HEADER)
    expect(sample.text.trimEnd().split("\n")).toHaveLength(201)

    expect((await postCsv(page, TINY_CSV)).status).toBe(200)

    const imported = await api(page, "/api/trades.csv")
    expect(imported.status).toBe(200)
    expect(imported.text).toBe(TINY_CSV)
  })
})
