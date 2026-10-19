import DecimalJs from "decimal.js"

/** Isolated Decimal constructor: 40 significant digits, round half up. All money math goes through it. */
export const Decimal = DecimalJs.clone({
  precision: 40,
  rounding: DecimalJs.ROUND_HALF_UP,
})

export type Decimal = InstanceType<typeof Decimal>
