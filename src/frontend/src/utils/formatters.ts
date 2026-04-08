/**
 * Shared formatting utilities for FinFolio.
 * Imported by components and pages that need currency, percent, date formatting.
 */

/** Currencies that use no decimal places */
const ZERO_DECIMAL_CURRENCIES = new Set(["VND", "JPY", "KRW", "IDR", "VUV"]);

export function formatCurrency(
  value: number,
  currency = "USD",
  compact = false,
): string {
  const cur = currency.toUpperCase();
  const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.has(cur);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur,
      notation: compact ? "compact" : "standard",
      minimumFractionDigits: compact ? 0 : isZeroDecimal ? 0 : 2,
      maximumFractionDigits: compact ? 1 : isZeroDecimal ? 0 : 2,
    }).format(value);
  } catch {
    return `${cur} ${isZeroDecimal ? Math.round(value).toLocaleString() : value.toFixed(2)}`;
  }
}

/**
 * Convert an amount from one currency to another using Frankfurter rates (all vs USD).
 * rates[currency] = how many USD 1 unit of that currency is worth.
 * For crypto (BTC, ETH), pass the USD price in the rates map under the symbol key.
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
): number {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  if (from === to) return amount;

  // Convert to USD first.
  // rates[currency] = "how many USD is 1 unit of that currency"
  // e.g. rates["VND"] ≈ 0.00004 (1 VND = 0.00004 USD)
  // e.g. rates["EUR"] ≈ 1.08    (1 EUR = 1.08 USD)
  let usdAmount: number;
  if (from === "USD") {
    usdAmount = amount;
  } else {
    const fromRate = rates[from];
    if (!fromRate || fromRate === 0) return amount; // unknown rate, return as-is
    usdAmount = amount * fromRate; // multiply: amount_in_FROM × (USD per 1 FROM) = USD
  }

  // Convert USD to target currency.
  // toRate = USD per 1 unit of TO → so 1 USD = 1/toRate units of TO
  // targetAmount = usdAmount / toRate
  if (to === "USD") return usdAmount;
  const toRate = rates[to];
  if (!toRate || toRate === 0) return usdAmount;
  return usdAmount / toRate;
}

/** Currency display info (flag emoji + code) */
export const CURRENCY_OPTIONS = [
  { code: "USD", flag: "🇺🇸", label: "USD — US Dollar" },
  { code: "VND", flag: "🇻🇳", label: "VND — Vietnamese Dong" },
  { code: "EUR", flag: "🇪🇺", label: "EUR — Euro" },
  { code: "GBP", flag: "🇬🇧", label: "GBP — British Pound" },
  { code: "JPY", flag: "🇯🇵", label: "JPY — Japanese Yen" },
  { code: "BTC", flag: "₿", label: "BTC — Bitcoin" },
  { code: "ETH", flag: "Ξ", label: "ETH — Ethereum" },
] as const;

export function formatNumber(value: number, decimals = 2): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * ICP timestamps are nanoseconds. Detect by magnitude (> year 3000 in ms = nanoseconds)
 * and convert to milliseconds before formatting.
 */
export function formatDate(timestamp: bigint | number): string {
  let ms: number;
  if (typeof timestamp === "bigint") {
    const raw = Number(timestamp);
    ms = raw > 1e15 ? Math.floor(raw / 1_000_000) : raw;
  } else {
    ms = timestamp > 1e15 ? Math.floor(timestamp / 1_000_000) : timestamp;
  }
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateInput(timestamp: bigint | number): string {
  let ms: number;
  if (typeof timestamp === "bigint") {
    const raw = Number(timestamp);
    ms = raw > 1e15 ? Math.floor(raw / 1_000_000) : raw;
  } else {
    ms = timestamp > 1e15 ? Math.floor(timestamp / 1_000_000) : timestamp;
  }
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function dateInputToTimestamp(dateStr: string): bigint {
  // Backend expects nanoseconds — multiply milliseconds by 1_000_000
  return BigInt(new Date(dateStr).getTime()) * 1_000_000n;
}
