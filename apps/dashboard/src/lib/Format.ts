/**
 * Synchronous currency / number formatting helpers shared by the dashboard.
 *
 * Use these for high-frequency render paths (lists, summaries, tooltips).
 * They use `Intl.NumberFormat` with a small instance cache so repeated
 * formatting at scale doesn't allocate a fresh formatter on every call.
 *
 * The wasm-backed `formatCurrencyWasm` exported from `@keiri/wasm` is the
 * right choice for OCR / wasm-resident contexts where `rust_decimal`
 * precision matters; not here.
 */

const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(locale: string | undefined, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  // The cache key includes the formatting flags so different fraction-digit
  // settings (e.g. budget-style "₹50,000" vs detail-style "₹50,000.50")
  // share the cache without colliding.
  const key = `${locale ?? "default"}|${JSON.stringify(options)}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    formatterCache.set(key, formatter);
  }
  return formatter;
}

export interface FormatCurrencyOptions {
  /** BCP-47 locale tag. Defaults to `en-IN` since the primary user base is India. */
  locale?: string;
  /** Override fraction digits. Defaults to the currency's locale convention. */
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
}

/**
 * Format a monetary amount with the currency symbol and locale-appropriate
 * grouping. Accepts a number or a stringified Decimal (the API returns
 * amounts as strings to preserve precision); falls back to `${currency}
 * ${amount}` when `Intl.NumberFormat` rejects the inputs.
 */
export function formatCurrency(amount: number | string, currency: string, opts: FormatCurrencyOptions = {}): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) return `${currency} ${amount}`;
  try {
    return getFormatter(opts.locale ?? "en-IN", {
      style: "currency",
      currency,
      ...(opts.maximumFractionDigits !== undefined && {
        maximumFractionDigits: opts.maximumFractionDigits,
      }),
      ...(opts.minimumFractionDigits !== undefined && {
        minimumFractionDigits: opts.minimumFractionDigits,
      }),
    }).format(value);
  } catch {
    // Most likely: currency code Intl doesn't recognise. Keep the value
    // visible rather than throwing in a render path.
    return `${currency} ${value.toFixed(2)}`;
  }
}
