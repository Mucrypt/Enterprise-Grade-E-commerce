// ============================================
// Display pricing -- single source of truth for what price/compare-at/
// discount is safe to render.
// ============================================
// Products' base_price is legally allowed to be 0 (Joi: .min(0), no DB
// CHECK relating it to sale_price) -- rendering it unconditionally as a
// "was" price produced a real, live bug: base_price=0, sale_price=33.99
// rendered "compare-at €0.00" and "SAVE -€33.99". This is the one place
// that decides whether a compare-at price is legitimate; every price
// display on the PDP goes through it instead of computing its own guard.

export interface DisplayPricing {
  sellingPrice: number
  /** Only set when there's a real, positive "was more" price to show. */
  compareAtPrice: number | null
  discountPercent: number | null
  discountAmount: number | null
}

export function getDisplayPricing(
  basePrice: number | string,
  salePrice: number | string | null | undefined,
): DisplayPricing {
  const base = Number(basePrice)
  const sale = salePrice != null ? Number(salePrice) : null

  const hasLegitimateDiscount =
    sale != null && !isNaN(sale) && sale > 0 && !isNaN(base) && base > sale

  const sellingPrice = hasLegitimateDiscount ? (sale as number) : base

  return {
    sellingPrice,
    compareAtPrice: hasLegitimateDiscount ? base : null,
    discountPercent: hasLegitimateDiscount
      ? Math.round(((base - (sale as number)) / base) * 100)
      : null,
    discountAmount: hasLegitimateDiscount ? base - (sale as number) : null,
  }
}
