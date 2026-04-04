/**
 * Shared formatting utilities for FinFolio.
 * Imported by components and pages that need currency, percent, date formatting.
 */

export function formatCurrency(
  value: number,
  currency = "USD",
  compact = false,
): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: compact ? "compact" : "standard",
      minimumFractionDigits: compact ? 0 : 2,
      maximumFractionDigits: compact ? 1 : 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

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

export function formatDate(timestamp: bigint | number): string {
  const ms = typeof timestamp === "bigint" ? Number(timestamp) : timestamp;
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateInput(timestamp: bigint | number): string {
  const ms = typeof timestamp === "bigint" ? Number(timestamp) : timestamp;
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function dateInputToTimestamp(dateStr: string): bigint {
  return BigInt(new Date(dateStr).getTime());
}
