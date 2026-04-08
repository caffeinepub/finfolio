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

export default function PortfolioPage() {
  const { data: holdings, isLoading } = useGetHoldings();
  const { prices, convert } = usePrices();
  const { data: profile } = useGetProfile();

  const baseCurrency = profile?.baseCurrency ?? "USD";

  // Enrich holdings with live prices and convert values to baseCurrency
  const enrichedHoldings = useMemo(() => {
    if (!holdings) return [];
    return holdings
      .map((h) => {
        const liveEntry = prices[h.symbol];
        const livePrice =
          liveEntry?.price !== undefined && liveEntry.price > 0
            ? liveEntry.price
            : h.currentPrice;
        const totalValueInAssetCurrency = h.quantity * livePrice;
        // Convert to baseCurrency for portfolio total
        const totalValueInBase = convert(
          totalValueInAssetCurrency,
          h.currency || "USD",
          baseCurrency,
        );
        const totalCostInBase = convert(
          h.totalCost,
          h.currency || "USD",
          baseCurrency,
        );
        const gainLossInBase = totalValueInBase - totalCostInBase;
        const gainLossPercent =
          totalCostInBase > 0 ? (gainLossInBase / totalCostInBase) * 100 : 0;
        return {
          ...h,
          currentPrice: livePrice,
          // original currency values for display
          totalValue: totalValueInAssetCurrency,
          gainLoss: totalValueInAssetCurrency - h.totalCost,
          gainLossPercent:
            h.totalCost > 0
              ? ((totalValueInAssetCurrency - h.totalCost) / h.totalCost) * 100
              : 0,
          // baseCurrency converted values for total and sorting
          totalValueInBase,
          totalCostInBase,
          gainLossInBase,
          gainLossPercentBase: gainLossPercent,
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

  const totalCost = useMemo(
    () => enrichedHoldings.reduce((sum, h) => sum + h.totalCostInBase, 0),
    [enrichedHoldings],
  );

  const totalGainLossPercent =
    totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

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
                  const assetCurrency = h.currency || "USD";
                  const showConverted =
                    assetCurrency.toUpperCase() !== baseCurrency.toUpperCase();
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
                      <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                        {formatCurrency(h.averageCost, assetCurrency)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-foreground tabular-nums">
                        <div className="flex flex-col items-end">
                          <span>
                            {formatCurrency(h.currentPrice, assetCurrency)}
                          </span>
                          {isLive && (
                            <span className="text-[10px] text-fin-green opacity-70">
                              live
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold text-foreground tabular-nums">
                        <div className="flex flex-col items-end">
                          <span>
                            {formatCurrency(h.totalValueInBase, baseCurrency)}
                          </span>
                          {showConverted && (
                            <span className="text-[10px] text-muted-foreground">
                              {formatCurrency(h.totalValue, assetCurrency)}
                            </span>
                          )}
                        </div>
                      </TableCell>
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
