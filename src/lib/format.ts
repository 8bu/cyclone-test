import { Decimal } from "@/domain/decimal"

/** Shown in place of a missing value. */
export const EM_DASH = "—"

export type Trend = "gain" | "loss" | "flat"

type Input = string | null | undefined

function toDecimal(value: Input): Decimal | null {
  if (value === null || value === undefined || value === "") return null
  try {
    const d = new Decimal(value)
    return d.isFinite() ? d : null
  } catch {
    return null
  }
}

function groupDigits(integer: string) {
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

/** Rounds half up to `dp` places and groups the integer part. Returns sign separately; "-0.00" has no sign. */
function toParts(d: Decimal | null, dp: number) {
  if (d === null) return null
  const fixed = d.abs().toFixed(dp, Decimal.ROUND_HALF_UP)
  const [integer, fraction] = fixed.split(".")
  const isZero = /^0(\.0*)?$/.test(fixed)
  return {
    negative: d.isNegative() && !isZero,
    zero: isZero,
    integer: groupDigits(integer),
    fraction,
  }
}

function signSymbol(negative: boolean, zero: boolean, withSign: boolean) {
  if (negative) return "\u2212"
  if (withSign && !zero) return "+"
  return ""
}

/** "$1,234.56", "-$1,234.56" (true minus), "+$1,234.56" with `sign`. */
export function formatUsd(value: Input, opts: { sign?: boolean } = {}) {
  const parts = toParts(toDecimal(value), 2)
  if (!parts) return EM_DASH
  return `${signSymbol(parts.negative, parts.zero, opts.sign ?? false)}$${parts.integer}.${parts.fraction}`
}

export function formatSignedUsd(value: Input) {
  return formatUsd(value, { sign: true })
}

/** Unit price: >= 1 -> 2 dp, < 1 -> up to 8 decimals with trailing zeros trimmed (min 2). */
export function formatPrice(value: Input) {
  const d = toDecimal(value)
  if (d === null) return EM_DASH
  if (d.abs().gte(1)) return formatUsd(value)
  const parts = toParts(d, 8)
  if (!parts) return EM_DASH
  let fraction = (parts.fraction ?? "").replace(/0+$/, "")
  if (fraction.length < 2) fraction = fraction.padEnd(2, "0")
  return `${signSymbol(parts.negative, parts.zero, false)}$${parts.integer}.${fraction}`
}

/** Asset quantity: up to 8 decimals, trailing zeros trimmed. */
export function formatQuantity(value: Input) {
  const parts = toParts(toDecimal(value), 8)
  if (!parts) return EM_DASH
  const fraction = (parts.fraction ?? "").replace(/0+$/, "")
  return `${signSymbol(parts.negative, parts.zero, false)}${parts.integer}${fraction ? `.${fraction}` : ""}`
}

/** `fraction` is a ratio: 0.1234 -> "12.34%". */
export function formatPercent(fraction: Input, opts: { sign?: boolean } = {}) {
  const d = toDecimal(fraction)
  if (d === null) return EM_DASH
  const parts = toParts(d.times(100), 2)
  if (!parts) return EM_DASH
  return `${signSymbol(parts.negative, parts.zero, opts.sign ?? false)}${parts.integer}.${parts.fraction}%`
}

/** USD with compact suffix for chart axes: 12500 -> "$12.5K". */
export function formatCompactUsd(value: number) {
  if (!Number.isFinite(value)) return EM_DASH
  const abs = Math.abs(value)
  const sign = value < 0 ? "\u2212" : ""
  if (abs >= 1e9) return `${sign}$${trimCompact(abs / 1e9)}B`
  if (abs >= 1e6) return `${sign}$${trimCompact(abs / 1e6)}M`
  if (abs >= 1e3) return `${sign}$${trimCompact(abs / 1e3)}K`
  return `${sign}$${trimCompact(abs)}`
}

function trimCompact(n: number) {
  return Number(n.toFixed(1)).toString()
}

/** "2025-10-01T09:00:00.000Z" -> "2025-10-01 09:00 UTC". */
export function formatDateTimeUtc(iso: Input) {
  if (!iso) return EM_DASH
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return EM_DASH
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`
}

/** Sign of the value as displayed (so a value that rounds to zero is "flat"). `dp` = displayed decimals. */
export function trend(value: Input, dp = 2): Trend {
  const parts = toParts(toDecimal(value), dp)
  if (!parts || parts.zero) return "flat"
  return parts.negative ? "loss" : "gain"
}

/** Converts a decimal string to a JS number. ONLY for chart rendering, never for money math. */
export function toChartNumber(value: Input) {
  const d = toDecimal(value)
  return d === null ? 0 : d.toNumber()
}
