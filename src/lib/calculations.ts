import Decimal from "decimal.js";
import type { Item } from "./types";
Decimal.set({ precision: 64, rounding: Decimal.ROUND_HALF_UP });
export function calculate(
  items: Item[],
  salesRate: string,
  advanceRate: string,
) {
  const subtotal = items.reduce(
    (s, i) => s.plus(new Decimal(i.quantity || 0).times(i.rate || 0)),
    new Decimal(0),
  );
  const sales = subtotal.times(salesRate || 0).div(100),
    incl = subtotal.plus(sales),
    advance = incl.times(advanceRate || 0).div(100);
  return {
    subtotal: subtotal.toFixed(),
    sales_tax_amount: sales.toFixed(),
    value_including_tax: incl.toFixed(),
    advance_tax_amount: advance.toFixed(),
    grand_total: incl.plus(advance).toFixed(),
  };
}
export function money(value: string | number = 0) {
  return new Decimal(value).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function wholeMoney(value: string | number = 0) {
  return new Decimal(value).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
