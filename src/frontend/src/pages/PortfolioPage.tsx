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
import { usePortfolioVisibilityContext } from "@/contexts/PortfolioVisibilityContext";
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
import { useTranslation } from "react-i18next";

function getLivePriceCurrency(
  category: Category,
  assetCurrency: string,
  symbol: string,
): string {
  if (category === Category.Crypto) return "USD";
  if (category === Category.Forex) return "USD";
  if (category === Category.Commodity) return "USD";
  if (category === Category.Stock) {
    if (symbol.toUpperCase().endsWith(".VN")) return "VND";
    return "USD";
  }
  return assetCurrency || "USD";
}

export default function PortfolioPage() {
  const { t } = useTranslation();
  const { data: holdings, isLoading } = useGetHoldings();
  const { prices, convert } = usePrices();
  const { data: profile } = useGetProfile();
  const { mask } = usePortfolioVisibilityContext();

  const baseCurrency = profile?.baseCurrency ?? "USD";

  const enrichedHoldings = useMemo(() => {
    if (!holdings) return [];
    return holdings
      .map((h) => {
        const liveEntry = prices[h.symbol];
        const livePrice =
          liveEntry?.price !== undefined && liveEntry.price > 0
            ? liveEntry.price
            : h.currentPrice;

        const livePriceCurrency = getLivePriceCurrency(
          h.category,
          h.currency || "USD",
          h.symbol,
        );

        const totalValueInLiveCurrency = h.quantity * livePrice;
        const totalValueInBase = convert(
          totalValueInLiveCurrency,
          livePriceCurrency,
          baseCurrency,
        );

        const assetCurrency = h.currency || "USD";
        const totalCostInBase = convert(
          h.totalCost,
          assetCurrency,
          baseCurrency,
        );
        const avgCostInBase = h.quantity > 0 ? totalCostInBase / h.quantity : 0;
        const gainLossInBase = totalValueInBase - totalCostInBase;
        const gainLossPercent =
          totalCostInBase > 0 ? (gainLossInBase / totalCostInBase) * 100 : 0;

        return {
          ...h,
          currentPrice: livePrice,
          livePriceCurrency,
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
      {/* Page header — responsive flex */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            {t("portfolio.title")}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {t("portfolio.subtitle")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-sm font-semibold text-foreground">
            {mask(formatCurrency(totalPortfolioValue, baseCurrency))}
          </span>
          <span
            className={`text-xs font-medium ${totalGainLoss >= 0 ? "text-fin-green" : "text-fin-red"}`}
          >
            {totalGainLoss >= 0 ? "+" : ""}
            {mask(formatCurrency(totalGainLoss, baseCurrency))} (
            {formatPercent(totalGainLossPercent)})
          </span>
          <span className="text-xs text-muted-foreground">
            {enrichedHoldings.length} {t("portfolio.holdings")} ·{" "}
            {t("portfolio.livePrices")} · {baseCurrency}
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
              title={t("portfolio.noHoldingsYet")}
              description={t("portfolio.noHoldingsDesc")}
              icon={Briefcase}
            />
          </div>
        ) : (
          <div className="overflow-x-auto w-full rounded-lg">
            <Table className="min-w-[380px]">
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground text-xs pl-4 sm:pl-5 whitespace-nowrap">
                    {t("portfolio.assetCol")}
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs whitespace-nowrap hidden sm:table-cell">
                    {t("portfolio.categoryCol")}
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right whitespace-nowrap">
                    {t("portfolio.quantityCol")}
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right whitespace-nowrap hidden sm:table-cell">
                    {t("portfolio.avgCostCol")}
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right whitespace-nowrap">
                    {t("portfolio.livePriceCol")}
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right whitespace-nowrap">
                    {t("portfolio.valueCol")} ({baseCurrency})
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right pr-4 sm:pr-5 whitespace-nowrap">
                    {t("portfolio.gainLossCol")} ({baseCurrency})
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrichedHoldings.map((h, i) => {
                  const isPositive = h.gainLossInBase >= 0;
                  const liveEntry = prices[h.symbol];
                  const isLive = liveEntry?.status === "live";
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
                      <TableCell className="pl-4 sm:pl-5">
                        <div className="flex flex-col">
                          <span className="text-xs sm:text-sm font-bold text-foreground font-mono">
                            {h.symbol}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {h.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <CategoryBadge category={h.category} />
                      </TableCell>
                      <TableCell className="text-right text-xs sm:text-sm text-foreground tabular-nums whitespace-nowrap">
                        {formatNumber(h.quantity, 4)}
                      </TableCell>
                      <TableCell className="text-right text-xs sm:text-sm text-muted-foreground tabular-nums whitespace-nowrap hidden sm:table-cell">
                        {mask(formatCurrency(h.avgCostInBase, baseCurrency))}
                      </TableCell>
                      <TableCell className="text-right text-xs sm:text-sm text-foreground tabular-nums">
                        <div className="flex flex-col items-end">
                          <span className="whitespace-nowrap">
                            {formatCurrency(h.currentPrice, livePriceCurrency)}
                          </span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            {livePriceLabel && <span>{livePriceLabel}</span>}
                            {isLive && (
                              <span className="text-fin-green">
                                {t("common.live")}
                              </span>
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs sm:text-sm font-semibold text-foreground tabular-nums whitespace-nowrap">
                        {mask(formatCurrency(h.totalValueInBase, baseCurrency))}
                      </TableCell>
                      <TableCell className="text-right pr-4 sm:pr-5">
                        <div
                          className={`flex flex-col items-end ${isPositive ? "text-fin-green" : "text-fin-red"}`}
                        >
                          <span className="text-xs sm:text-sm font-medium flex items-center gap-1 whitespace-nowrap">
                            {isPositive ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            {mask(
                              formatCurrency(h.gainLossInBase, baseCurrency),
                            )}
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
