import { Category } from "@/backend.d";
import { CategoryBadge } from "@/components/Badges";
import { EmptyState, PageLoader } from "@/components/LoadingStates";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePrices } from "@/contexts/PriceFeedContext";
import { useGetHoldings, useGetProfile } from "@/hooks/useQueries";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
} from "@/utils/formatters";
import { Briefcase, TrendingDown, TrendingUp } from "lucide-react";
import { motion } from "motion/react";
import { useMemo } from "react";

/**
 * Determine the native currency a live price is quoted in.
 * - Crypto: CoinGecko always returns USD prices regardless of asset.currency
 * - Forex:  Frankfurter returns the exchange rate vs USD (price IS the USD value of 1 unit)
 * - Stock:  Yahoo Finance returns the price in the stock's native currency
 *           (VNM.VN → VND, AAPL → USD)
 * - Cash:   manualPrice is stored in asset.currency
 */
function getLivePriceCurrency(
  category: Category,
  assetCurrency: string,
  symbol: string,
): string {
  if (category === Category.Crypto) return "USD"; // CoinGecko always USD
  if (category === Category.Forex) return "USD"; // rate is expressed as USD per 1 unit, handled separately
  if (category === Category.Stock) {
    // Vietnamese stocks have .VN suffix → price is VND
    if (symbol.toUpperCase().endsWith(".VN")) return "VND";
    // All other stocks → USD from Yahoo Finance
    return "USD";
  }
  // Cash: value stored in asset currency
  return assetCurrency || "USD";
}

export default function PortfolioPage() {
  const { data: holdings, isLoading } = useGetHoldings();
  const { prices, convert } = usePrices();
  const { data: profile } = useGetProfile();

  const baseCurrency = profile?.baseCurrency ?? "USD";

  // Enrich holdings with live prices and convert ALL values to baseCurrency
  const enrichedHoldings = useMemo(() => {
    if (!holdings) return [];
    return holdings
      .map((h) => {
        const liveEntry = prices[h.symbol];
        const livePrice =
          liveEntry?.price !== undefined && liveEntry.price > 0
            ? liveEntry.price
            : h.currentPrice;

        // Determine the currency the live price is actually quoted in
        const livePriceCurrency = getLivePriceCurrency(
          h.category,
          h.currency || "USD",
          h.symbol,
        );

        // Total value in the live price's currency
        const totalValueInLiveCurrency = h.quantity * livePrice;

        // Convert total value to baseCurrency using the correct source currency
        const totalValueInBase = convert(
          totalValueInLiveCurrency,
          livePriceCurrency,
          baseCurrency,
        );

        // Cost basis: transactions were recorded in asset.currency
        // (the currency user selected when adding transactions)
        const assetCurrency = h.currency || "USD";
        const totalCostInBase = convert(
          h.totalCost,
          assetCurrency,
          baseCurrency,
        );

        // Avg cost per unit in baseCurrency
        const avgCostInBase = h.quantity > 0 ? totalCostInBase / h.quantity : 0;

        const gainLossInBase = totalValueInBase - totalCostInBase;
        const gainLossPercent =
          totalCostInBase > 0 ? (gainLossInBase / totalCostInBase) * 100 : 0;

        return {
          ...h,
          currentPrice: livePrice,
          livePriceCurrency,
          // baseCurrency converted values — all display columns use these
          totalValueInBase,
          totalCostInBase,
          avgCostInBase,
          gainLossInBase,
          gainLossPercent,
        };
      })
      .sort((a, b) => b.totalValueInBase - a.totalValueInBase);
  }, [holdings, prices, convert, baseCurrency]);

  const totalPortfolioValue = useMemo(
    () => enrichedHoldings.reduce((sum, h) => sum + h.totalValueInBase, 0),
    [enrichedHoldings],
  );

  const totalGainLoss = useMemo(
    () => enrichedHoldings.reduce((sum, h) => sum + h.gainLossInBase, 0),
    [enrichedHoldings],
  );

  const totalCostBase = useMemo(
    () => enrichedHoldings.reduce((sum, h) => sum + h.totalCostInBase, 0),
    [enrichedHoldings],
  );

  const totalGainLossPercent =
    totalCostBase > 0 ? (totalGainLoss / totalCostBase) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Portfolio</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Your current holdings and performance
          </p>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-sm font-semibold text-foreground">
            {formatCurrency(totalPortfolioValue, baseCurrency)}
          </span>
          <span
            className={`text-xs font-medium ${totalGainLoss >= 0 ? "text-fin-green" : "text-fin-red"}`}
          >
            {totalGainLoss >= 0 ? "+" : ""}
            {formatCurrency(totalGainLoss, baseCurrency)} (
            {formatPercent(totalGainLossPercent)})
          </span>
          <span className="text-xs text-muted-foreground">
            {enrichedHoldings.length} holdings · live prices · {baseCurrency}
          </span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <PageLoader />
          </div>
        ) : enrichedHoldings.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No holdings yet"
              description="Add assets and transactions to see your portfolio here."
              icon={Briefcase}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground text-xs pl-5">
                    Asset
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs">
                    Category
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">
                    Quantity
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">
                    Avg Cost
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">
                    Live Price
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">
                    Value ({baseCurrency})
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right pr-5">
                    Gain/Loss ({baseCurrency})
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrichedHoldings.map((h, i) => {
                  const isPositive = h.gainLossInBase >= 0;
                  const liveEntry = prices[h.symbol];
                  const isLive = liveEntry?.status === "live";
                  // Show original price currency label when it differs from baseCurrency
                  const livePriceCurrency = h.livePriceCurrency;
                  const livePriceLabel =
                    livePriceCurrency.toUpperCase() !==
                    baseCurrency.toUpperCase()
                      ? livePriceCurrency
                      : null;
                  return (
                    <TableRow
                      key={h.assetId.toString()}
                      className="border-border hover:bg-muted/30 transition-colors"
                      data-ocid={`portfolio.item.${i + 1}`}
                    >
                      <TableCell className="pl-5">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-foreground font-mono">
                            {h.symbol}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {h.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <CategoryBadge category={h.category} />
                      </TableCell>
                      <TableCell className="text-right text-sm text-foreground tabular-nums">
                        {formatNumber(h.quantity, 4)}
                      </TableCell>
                      {/* Avg Cost in baseCurrency */}
                      <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                        {formatCurrency(h.avgCostInBase, baseCurrency)}
                      </TableCell>
                      {/* Live Price in its native currency with label */}
                      <TableCell className="text-right text-sm text-foreground tabular-nums">
                        <div className="flex flex-col items-end">
                          <span>
                            {formatCurrency(h.currentPrice, livePriceCurrency)}
                          </span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            {livePriceLabel && <span>{livePriceLabel}</span>}
                            {isLive && (
                              <span className="text-fin-green">live</span>
                            )}
                          </span>
                        </div>
                      </TableCell>
                      {/* Total Value in baseCurrency */}
                      <TableCell className="text-right text-sm font-semibold text-foreground tabular-nums">
                        {formatCurrency(h.totalValueInBase, baseCurrency)}
                      </TableCell>
                      {/* Gain/Loss in baseCurrency */}
                      <TableCell className="text-right pr-5">
                        <div
                          className={`flex flex-col items-end ${isPositive ? "text-fin-green" : "text-fin-red"}`}
                        >
                          <span className="text-sm font-medium flex items-center gap-1">
                            {isPositive ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            {formatCurrency(h.gainLossInBase, baseCurrency)}
                          </span>
                          <span className="text-xs opacity-80">
                            {formatPercent(h.gainLossPercent)}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </motion.div>
  );
}
