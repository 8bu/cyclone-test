import { MinusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  EM_DASH,
  formatPercent,
  formatSignedUsd,
  trend,
  type Trend,
} from "@/lib/format"

const TREND_STYLES: Record<
  Trend,
  { icon: typeof MinusIcon; className: string; word: string }
> = {
  gain: { icon: TrendingUpIcon, className: "text-gain", word: "gain" },
  loss: { icon: TrendingDownIcon, className: "text-loss", word: "loss" },
  flat: { icon: MinusIcon, className: "text-muted-foreground", word: "no change" },
}

/**
 * Signed value with an icon, a colour and a screen-reader word, so gain vs loss
 * never relies on colour alone. `value` is a decimal string (USD, or a fraction when kind="percent").
 */
export function PnlValue({
  value,
  kind = "usd",
  showIcon = true,
  align = "end",
  className,
}: {
  value: string | null | undefined
  kind?: "usd" | "percent"
  showIcon?: boolean
  align?: "start" | "end"
  className?: string
}) {
  if (value === null || value === undefined) {
    return (
      <span className={cn("text-muted-foreground", className)}>
        <span aria-hidden="true">{EM_DASH}</span>
        <span className="sr-only">Not available</span>
      </span>
    )
  }

  const kindOfTrend = trend(value, kind === "percent" ? 4 : 2)
  const { icon: Icon, className: colour, word } = TREND_STYLES[kindOfTrend]
  const text =
    kind === "percent"
      ? formatPercent(value, { sign: true })
      : formatSignedUsd(value)

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 tabular-nums",
        align === "end" ? "justify-end" : "justify-start",
        colour,
        className
      )}
    >
      {showIcon && <Icon aria-hidden="true" className="size-3.5 shrink-0" />}
      <span className="sr-only">{word}</span>
      <span>{text}</span>
    </span>
  )
}
