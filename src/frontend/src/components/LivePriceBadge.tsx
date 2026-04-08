import { Skeleton } from "@/components/ui/skeleton";
import { usePrices } from "@/contexts/PriceFeedContext";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const SOURCE_LABELS: Record<string, string> = {
  coingecko: "CoinGecko",
  frankfurter: "Frankfurter",
  yahoo: "Yahoo Finance",
  manual: "Manual",
};

function formatPrice(price: number, currency = "USD"): string {
  if (price === 0) return "--";
  try {
    if (currency === "VND") {
      return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
      }).format(price);
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency === "BTC" || currency === "ETH" ? "USD" : currency,
      minimumFractionDigits:
        price < 0.01 ? 6 : price < 1 ? 4 : price < 100 ? 2 : 2,
      maximumFractionDigits: price < 0.01 ? 6 : price < 1 ? 4 : 2,
    }).format(price);
  } catch {
    return `${price.toFixed(2)} ${currency}`;
  }
}

interface LivePriceBadgeProps {
  symbol: string;
  currency?: string;
  className?: string;
}

export function LivePriceBadge({
  symbol,
  currency = "USD",
  className,
}: LivePriceBadgeProps) {
  const { prices, isLoading } = usePrices();
  const { t } = useTranslation();
  const entry = prices[symbol];

  if (isLoading && !entry) {
    return (
      <div className={cn("flex flex-col items-end gap-1", className)}>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-3 w-12" />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className={cn("flex flex-col items-end gap-0.5", className)}>
        <span className="text-sm text-muted-foreground tabular-nums">--</span>
        <span className="text-[10px] text-muted-foreground">
          {t("liveprice.manual")}
        </span>
      </div>
    );
  }

  const isPositive = entry.change24h >= 0;
  const changeColor = isPositive ? "text-fin-green" : "text-fin-red";
  const changePrefix = isPositive ? "+" : "";

  const dotColor =
    entry.status === "live"
      ? "bg-fin-green animate-pulse"
      : entry.status === "no-key"
        ? "bg-yellow-400"
        : entry.status === "error"
          ? "bg-fin-red"
          : "bg-muted-foreground";

  const statusSuffix =
    entry.status === "no-key"
      ? ` (${t("liveprice.noKey")})`
      : entry.status === "error"
        ? ` (${t("liveprice.error")})`
        : "";

  return (
    <div className={cn("flex flex-col items-end gap-0.5", className)}>
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "inline-block w-1.5 h-1.5 rounded-full flex-shrink-0",
            dotColor,
          )}
          title={entry.status}
        />
        <span className="text-sm font-semibold text-foreground tabular-nums">
          {formatPrice(entry.price, currency)}
        </span>
        {entry.change24h !== 0 && (
          <span className={cn("text-xs tabular-nums font-medium", changeColor)}>
            {changePrefix}
            {entry.change24h.toFixed(2)}%
          </span>
        )}
      </div>
      <span className="text-[10px] text-muted-foreground">
        {SOURCE_LABELS[entry.source] ?? entry.source}
        {statusSuffix}
      </span>
    </div>
  );
}
