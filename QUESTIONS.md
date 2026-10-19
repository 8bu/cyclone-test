# Open questions for the client

Each row: the question, what we decided, and why. Ask the client to confirm.

| # | Question | Our decision (for now) | Why |
|---|----------|------------------------|-----|
| 1 | The spec says "each asset in the calculation scope". Is cost basis pooled per asset across Binance and Coinbase, or kept per exchange? | Pooled per asset across both exchanges. One weighted-average cost for each symbol. | The holdings table has one row per asset. "A SELL never exceeds the quantity available" reads as one position per asset. |
