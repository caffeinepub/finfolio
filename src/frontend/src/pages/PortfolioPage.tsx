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
import { useGetHoldings } from "@/hooks/useQueries";
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
  const { prices } = usePrices();

  // Override backend holdings with live prices from PriceFeedContext
  const enrichedHoldings = useMemo(() => {
    if (!holdings) return [];
    return holdings
      .map((h) => {
        const liveEntry = prices[h.symbol];
        const livePrice =
          liveEntry?.price !== undefined && liveEntry.price > 0
            ? liveEntry.price
            : h.currentPrice;
        const totalValue = h.quantity * livePrice;
        const gainLoss = totalValue - h.totalCost;
        const gainLossPercent =
          h.totalCost > 0 ? (gainLoss / h.totalCost) * 100 : 0;
        return {
          ...h,
          currentPrice: livePrice,
          totalValue,
          gainLoss,
          gainLossPercent,
        };
      })
      .sort((a, b) => b.totalValue - a.totalValue);
  }, [holdings, prices]);

  const totalPortfolioValue = useMemo(
    () => enrichedHoldings.reduce((sum, h) => sum + h.totalValue, 0),
    [enrichedHoldings],
  );

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
            {formatCurrency(totalPortfolioValue, "USD")}
          </span>
          <span className="text-xs text-muted-foreground">
            {enrichedHoldings.length} holdings · live prices
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
                    Total Value
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right pr-5">
                    Gain/Loss
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrichedHoldings.map((h, i) => {
                  const isPositive = h.gainLoss >= 0;
                  const liveEntry = prices[h.symbol];
                  const isLive = liveEntry?.status === "live";
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
                        {formatCurrency(h.averageCost, h.currency)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-foreground tabular-nums">
                        <div className="flex flex-col items-end">
                          <span>
                            {formatCurrency(h.currentPrice, h.currency)}
                          </span>
                          {isLive && (
                            <span className="text-[10px] text-fin-green opacity-70">
                              live
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold text-foreground tabular-nums">
                        {formatCurrency(h.totalValue, h.currency)}
                      </TableCell>
                      <TableCell className="text-right pr-5">
                        <div
                          className={`flex flex-col items-end ${
                            isPositive ? "text-fin-green" : "text-fin-red"
                          }`}
                        >
                          <span className="text-sm font-medium flex items-center gap-1">
                            {isPositive ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            {formatCurrency(h.gainLoss, h.currency)}
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
