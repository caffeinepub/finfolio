import { TxType } from "@/backend.d";
import type { Public__1 } from "@/backend.d";
import { Category } from "@/backend.d";
import { TxTypeBadge } from "@/components/Badges";
import KpiCard from "@/components/KpiCard";
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
import type { OnPricesUpdatedFn } from "@/contexts/PriceFeedContext";
import {
  useAddSnapshot,
  useGetAssets,
  useGetProfile,
  useGetSnapshots,
  useGetTransactions,
} from "@/hooks/useQueries";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { ArrowLeftRight } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const CATEGORY_COLORS: Record<string, string> = {
  Stock: "oklch(0.6 0.2 250)",
  Crypto: "oklch(0.72 0.2 155)",
  Forex: "oklch(0.6 0.22 300)",
  Cash: "oklch(0.75 0.18 55)",
  Commodity: "oklch(0.78 0.18 80)",
  RealEstate: "oklch(0.65 0.15 180)",
  Bond: "oklch(0.65 0.18 30)",
  Fund: "oklch(0.68 0.16 200)",
  Savings: "oklch(0.72 0.14 100)",
};

// Colors for individual assets within a category pie chart
const SLICE_PALETTE = [
  "oklch(0.72 0.2 155)",
  "oklch(0.6 0.2 250)",
  "oklch(0.75 0.18 55)",
  "oklch(0.78 0.18 80)",
  "oklch(0.65 0.15 180)",
  "oklch(0.6 0.22 300)",
  "oklch(0.65 0.18 30)",
  "oklch(0.68 0.16 200)",
  "oklch(0.72 0.14 100)",
  "oklch(0.7 0.18 340)",
];

interface Props {
  dateRange: string;
}

function getDateRangeMs(label: string): number {
  const map: Record<string, number> = {
    "Last 7 Days": 7,
    "Last 30 Days": 30,
    "Last 90 Days": 90,
    "Last Year": 365,
    "All Time": 3650,
  };
  return (map[label] ?? 30) * 24 * 60 * 60 * 1000;
}

function calcHoldingsQuantity(
  assets: Public__1[],
  transactions: {
    assetId: bigint;
    txType: TxType;
    quantity: number;
    price: number;
    fee: number;
    currency?: string;
  }[],
  convert: (amount: number, from: string, to: string) => number,
  baseCurrency: string,
): Map<string, { quantity: number; totalCost: number }> {
  const map = new Map<string, { quantity: number; totalCost: number }>();
  for (const asset of assets) {
    map.set(String(asset.id), { quantity: 0, totalCost: 0 });
  }
  for (const tx of transactions) {
    const txIdKey = String(tx.assetId);
    const asset = assets.find((a) => String(a.id) === txIdKey);
    const txCurrency = tx.currency ?? asset?.currency ?? "USD";
    const current = map.get(txIdKey) ?? { quantity: 0, totalCost: 0 };
    if (tx.txType === TxType.Buy || tx.txType === TxType.Deposit) {
      const costInBase = convert(
        tx.quantity * tx.price + tx.fee,
        txCurrency,
        baseCurrency,
      );
      map.set(txIdKey, {
        quantity: current.quantity + tx.quantity,
        totalCost: current.totalCost + costInBase,
      });
    } else if (tx.txType === TxType.Sell || tx.txType === TxType.Withdraw) {
      map.set(txIdKey, {
        quantity: current.quantity - tx.quantity,
        totalCost: current.totalCost,
      });
    }
  }
  return map;
}

const SNAPSHOT_THROTTLE_MS = 5 * 60 * 1000;

// Custom tooltip for the main allocation donut chart
function AllocationTooltip({
  active,
  payload,
  baseCurrency,
  tValue,
  tShare,
  mask,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: { percentage: number; displayName: string };
  }>;
  baseCurrency: string;
  tValue: string;
  tShare: string;
  mask: (value: string) => string;
}) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];
  const catKey = item.name as string;
  const value = item.value as number;
  const pct = item.payload.percentage;
  const displayName = item.payload.displayName;
  const color = (CATEGORY_COLORS[catKey] ?? "oklch(0.6 0.1 240)") as string;
  return (
    <div
      style={{
        background: "oklch(0.17 0.035 240)",
        border: "1px solid oklch(0.24 0.04 240)",
        borderRadius: 8,
        color: "oklch(0.93 0.015 240)",
        fontSize: 12,
        padding: "8px 12px",
        minWidth: 170,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 4,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: color,
            display: "inline-block",
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 600 }}>{displayName}</span>
      </div>
      <div
        style={{ display: "flex", justifyContent: "space-between", gap: 16 }}
      >
        <span style={{ color: "oklch(0.65 0.02 240)" }}>{tValue}</span>
        <span>{mask(formatCurrency(value, baseCurrency))}</span>
      </div>
      <div
        style={{ display: "flex", justifyContent: "space-between", gap: 16 }}
      >
        <span style={{ color: "oklch(0.65 0.02 240)" }}>{tShare}</span>
        <span>{pct.toFixed(1)}%</span>
      </div>
    </div>
  );
}

// Custom tooltip for per-category asset pie charts
function CategoryAssetTooltip({
  active,
  payload,
  baseCurrency,
  tValue,
  tShare,
  mask,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: { percentage: number; symbol: string };
  }>;
  baseCurrency: string;
  tValue: string;
  tShare: string;
  mask: (value: string) => string;
}) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];
  const value = item.value as number;
  const pct = item.payload.percentage;
  const symbol = item.payload.symbol;
  return (
    <div
      style={{
        background: "oklch(0.17 0.035 240)",
        border: "1px solid oklch(0.24 0.04 240)",
        borderRadius: 8,
        color: "oklch(0.93 0.015 240)",
        fontSize: 12,
        padding: "8px 12px",
        minWidth: 170,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 4,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: SLICE_PALETTE[0],
            display: "inline-block",
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 600 }}>{symbol}</span>
      </div>
      <div
        style={{ display: "flex", justifyContent: "space-between", gap: 16 }}
      >
        <span style={{ color: "oklch(0.65 0.02 240)" }}>{tValue}</span>
        <span>{mask(formatCurrency(value, baseCurrency))}</span>
      </div>
      <div
        style={{ display: "flex", justifyContent: "space-between", gap: 16 }}
      >
        <span style={{ color: "oklch(0.65 0.02 240)" }}>{tShare}</span>
        <span>{pct.toFixed(1)}%</span>
      </div>
    </div>
  );
}

export default function OverviewPage({ dateRange }: Props) {
  const { t } = useTranslation();
  const { mask } = usePortfolioVisibilityContext();
  const rangeMs = getDateRangeMs(dateRange);
  const NS_PER_MS = 1_000_000n;
  const { startDate, endDate } = useMemo(() => {
    const now = Date.now();
    return {
      startDate: BigInt(now - rangeMs) * NS_PER_MS,
      endDate: BigInt(now) * NS_PER_MS,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeMs]);

  const { data: transactions, isLoading: txLoading } = useGetTransactions();
  const { data: assets, isLoading: assetsLoading } = useGetAssets();
  const { data: snapshots, isLoading: snapsLoading } = useGetSnapshots(
    startDate,
    endDate,
  );
  const {
    prices,
    isLoading: pricesLoading,
    convert,
    onPricesUpdated,
  } = usePrices();
  const { data: profile } = useGetProfile();
  const addSnapshot = useAddSnapshot();

  const baseCurrency = profile?.baseCurrency ?? "USD";
  const lastSnapshotTimeRef = useRef<number>(0);

  const assetMap = useMemo(() => {
    const m = new Map<string, string>();
    if (assets) {
      for (const a of assets) m.set(a.id.toString(), a.symbol);
    }
    return m;
  }, [assets]);

  const assetById = useMemo(() => {
    const m = new Map<string, Public__1>();
    if (assets) for (const a of assets) m.set(String(a.id), a);
    return m;
  }, [assets]);

  const holdingsMap = useMemo(() => {
    if (!assets || !transactions)
      return new Map<string, { quantity: number; totalCost: number }>();
    return calcHoldingsQuantity(assets, transactions, convert, baseCurrency);
  }, [assets, transactions, convert, baseCurrency]);

  const portfolioStats = useMemo(() => {
    if (!assets || assets.length === 0) {
      return {
        totalValue: 0,
        totalCost: 0,
        gainLoss: 0,
        gainLossPercent: 0,
        allocationByCategory: [] as {
          name: string;
          displayName: string;
          value: number;
          percentage: number;
        }[],
        pieAllocation: [] as {
          name: string;
          displayName: string;
          value: number;
          percentage: number;
        }[],
      };
    }

    let totalValue = 0;
    let totalCost = 0;
    const categoryValues: Record<string, number> = {};

    for (const asset of assets) {
      const holding = holdingsMap.get(String(asset.id));
      const quantity = holding?.quantity ?? 0;
      const cost = holding?.totalCost ?? 0; // already in baseCurrency

      let currentValue: number;
      // Hoist livePrice so the post-block filter can reference it regardless
      // of which branch ran (Cash/RealEstate have no live price concept).
      let livePrice = 0;

      if (
        asset.category === Category.Cash ||
        asset.category === Category.RealEstate
      ) {
        currentValue = convert(
          asset.manualPrice,
          asset.currency || "USD",
          baseCurrency,
        );
        totalCost += currentValue;
      } else {
        const entry = prices[asset.symbol];
        livePrice = entry && entry.price > 0 ? entry.price : 0;

        const priceCurrency =
          asset.category === Category.Crypto ||
          asset.category === Category.Commodity
            ? "USD"
            : asset.currency || "USD";

        if (livePrice > 0) {
          // Primary: use live price — always takes priority
          currentValue = convert(
            quantity * livePrice,
            priceCurrency,
            baseCurrency,
          );
        } else if (asset.manualPrice > 0) {
          // Secondary: use manual price set by user
          currentValue = convert(
            quantity * asset.manualPrice,
            priceCurrency,
            baseCurrency,
          );
        } else if (quantity > 0 && cost > 0) {
          // Tertiary fallback: API failed — use total cost as current value proxy
          // (cost is already in baseCurrency, no conversion needed)
          currentValue = cost;
        } else {
          currentValue = 0;
        }

        totalCost += cost;
      }

      // Skip only when there is genuinely nothing to show — no live price AND
      // no computed value. This ensures Commodity assets (e.g. Gold/XAU) whose
      // price is fetched but quantity=0 (no transactions yet) still appear in
      // the allocation breakdown with their category registered.
      if (currentValue <= 0 && livePrice <= 0) continue;

      totalValue += currentValue;
      const catKey = asset.category as string;
      categoryValues[catKey] = (categoryValues[catKey] ?? 0) + currentValue;
    }

    const gainLoss = totalValue - totalCost;
    const gainLossPercent = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0;

    // pieAllocation: only non-zero categories (pie chart needs value > 0)
    const pieAllocation = Object.entries(categoryValues)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({
        name,
        displayName: t(`badges.${name}`, { defaultValue: name }),
        value,
        percentage: totalValue > 0 ? (value / totalValue) * 100 : 0,
      }));

    // allocationByCategory: includes zero-value categories so the legend
    // always shows every category that has an asset with a live price.
    const allocationByCategory = Object.entries(categoryValues)
      .map(([name, value]) => ({
        name,
        displayName: t(`badges.${name}`, { defaultValue: name }),
        value,
        percentage: totalValue > 0 ? (value / totalValue) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    return {
      totalValue,
      totalCost,
      gainLoss,
      gainLossPercent,
      allocationByCategory,
      pieAllocation,
    };
  }, [assets, holdingsMap, prices, convert, baseCurrency, t]);

  // Per-category asset breakdown for individual pie charts
  const categoryAssetBreakdowns = useMemo(() => {
    if (!assets || assets.length === 0) return [];

    // Group assets by category with their values
    const byCategory: Record<
      string,
      Array<{ symbol: string; name: string; value: number }>
    > = {};

    for (const asset of assets) {
      const holding = holdingsMap.get(String(asset.id));
      const quantity = holding?.quantity ?? 0;
      const cost = holding?.totalCost ?? 0; // already in baseCurrency

      let currentValue: number;
      // Hoist livePrice so the filter below can reference it outside the else block.
      let livePrice = 0;

      if (
        asset.category === Category.Cash ||
        asset.category === Category.RealEstate
      ) {
        currentValue = convert(
          asset.manualPrice,
          asset.currency || "USD",
          baseCurrency,
        );
      } else {
        const entry = prices[asset.symbol];
        livePrice = entry && entry.price > 0 ? entry.price : 0;

        const priceCurrency =
          asset.category === Category.Crypto ||
          asset.category === Category.Commodity
            ? "USD"
            : asset.currency || "USD";

        if (livePrice > 0) {
          currentValue = convert(
            quantity * livePrice,
            priceCurrency,
            baseCurrency,
          );
        } else if (asset.manualPrice > 0) {
          currentValue = convert(
            quantity * asset.manualPrice,
            priceCurrency,
            baseCurrency,
          );
        } else if (quantity > 0 && cost > 0) {
          currentValue = cost;
        } else {
          currentValue = 0;
        }
      }

      // Include the asset if it has any value OR if a live price exists (so
      // the category appears in breakdowns even with zero quantity/transactions).
      if (currentValue <= 0 && livePrice <= 0) continue;

      const catKey = asset.category as string;
      if (!byCategory[catKey]) byCategory[catKey] = [];
      byCategory[catKey].push({
        symbol: asset.symbol,
        name: asset.name || asset.symbol,
        value: currentValue,
      });
    }

    return Object.entries(byCategory)
      .filter(([, items]) => items.length > 0)
      .map(([catKey, items]) => {
        const total = items.reduce((sum, i) => sum + i.value, 0);
        return {
          category: catKey,
          displayName: t(`badges.${catKey}`, { defaultValue: catKey }),
          color: CATEGORY_COLORS[catKey] ?? "oklch(0.6 0.1 240)",
          slices: items
            .sort((a, b) => b.value - a.value)
            .map((item) => ({
              ...item,
              percentage: total > 0 ? (item.value / total) * 100 : 0,
            })),
        };
      })
      .filter((cat) => cat.slices.length >= 1); // Show categories with ≥1 asset
  }, [assets, holdingsMap, prices, convert, baseCurrency, t]);

  const dailyChangeStats = useMemo(() => {
    if (!assets || assets.length === 0 || portfolioStats.totalValue === 0) {
      return { dailyChangeAmount: null, dailyChangePercent: null };
    }
    let weightedChange = 0;
    let hasAnyChange = false;
    for (const asset of assets) {
      if (
        asset.category === Category.Cash ||
        asset.category === Category.RealEstate
      )
        continue;
      const entry = prices[asset.symbol];
      if (!entry || entry.price <= 0 || entry.change24h === 0) continue;
      const holding = holdingsMap.get(String(asset.id));
      const quantity = holding?.quantity ?? 0;
      if (quantity <= 0) continue;
      const priceCurrency =
        asset.category === Category.Crypto ||
        asset.category === Category.Commodity
          ? "USD"
          : asset.currency || "USD";
      const valueInBase = convert(
        quantity * entry.price,
        priceCurrency,
        baseCurrency,
      );
      if (valueInBase > 0 && portfolioStats.totalValue > 0) {
        weightedChange +=
          entry.change24h * (valueInBase / portfolioStats.totalValue);
        hasAnyChange = true;
      }
    }
    if (!hasAnyChange)
      return { dailyChangeAmount: null, dailyChangePercent: null };
    const dailyChangeAmount =
      portfolioStats.totalValue * (weightedChange / 100);
    return { dailyChangeAmount, dailyChangePercent: weightedChange };
  }, [
    assets,
    prices,
    holdingsMap,
    portfolioStats.totalValue,
    convert,
    baseCurrency,
  ]);

  const chartData = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return [];
    return snapshots
      .slice()
      .sort((a, b) => Number(a.date) - Number(b.date))
      .map((s) => ({ date: formatDate(s.date), value: s.totalValue }));
  }, [snapshots]);

  const sparklineData = useMemo(() => {
    if (!snapshots || snapshots.length < 2) return [];
    return snapshots
      .slice()
      .sort((a, b) => Number(a.date) - Number(b.date))
      .slice(-10)
      .map((s) => s.totalValue);
  }, [snapshots]);

  const recentTx = useMemo(() => {
    if (!transactions) return [];
    return [...transactions]
      .sort((a, b) => Number(b.date) - Number(a.date))
      .slice(0, 8);
  }, [transactions]);

  const handlePricesUpdated: OnPricesUpdatedFn = useCallback(
    (updatedPrices, updatedAssets) => {
      if (!updatedAssets || updatedAssets.length === 0) return;
      if (!transactions || transactions.length === 0) return;
      const elapsed = Date.now() - lastSnapshotTimeRef.current;
      if (elapsed < SNAPSHOT_THROTTLE_MS) return;

      const hMap = calcHoldingsQuantity(
        updatedAssets,
        transactions,
        convert,
        baseCurrency,
      );
      let total = 0;
      for (const asset of updatedAssets) {
        if (
          asset.category === Category.Cash ||
          asset.category === Category.RealEstate
        ) {
          total += convert(
            asset.manualPrice,
            asset.currency || "USD",
            baseCurrency,
          );
        } else {
          const entry = updatedPrices[asset.symbol];
          const livePrice = entry && entry.price > 0 ? entry.price : 0;
          const holding = hMap.get(String(asset.id));
          const qty = holding?.quantity ?? 0;
          const holdingCost = holding?.totalCost ?? 0;
          if (qty <= 0 && holdingCost <= 0) continue;

          const priceCurrency =
            asset.category === Category.Crypto ||
            asset.category === Category.Commodity
              ? "USD"
              : asset.currency || "USD";

          if (livePrice > 0) {
            total += convert(qty * livePrice, priceCurrency, baseCurrency);
          } else if (asset.manualPrice > 0) {
            total += convert(
              qty * asset.manualPrice,
              priceCurrency,
              baseCurrency,
            );
          } else if (holdingCost > 0) {
            total += holdingCost;
          }
        }
      }
      if (total <= 0) return;

      lastSnapshotTimeRef.current = Date.now();
      const ts = BigInt(Date.now()) * 1_000_000n;
      addSnapshot.mutate({
        id: 0n,
        totalValue: total,
        date: ts,
        createdAt: ts,
      });
    },
    [transactions, addSnapshot, convert, baseCurrency],
  );

  useEffect(() => {
    const unsubscribe = onPricesUpdated(handlePricesUpdated);
    return unsubscribe;
  }, [onPricesUpdated, handlePricesUpdated]);

  const isLoading = assetsLoading || txLoading || pricesLoading;

  const yAxisFormatter = useCallback(
    (v: number) => {
      if (baseCurrency === "VND") return `${(v / 1_000_000).toFixed(0)}M₫`;
      return `$${(v / 1000).toFixed(0)}k`;
    },
    [baseCurrency],
  );

  const tValue = t("overview.valueCol");
  const tShare = t("overview.shareCol");

  return (
    <div className="animate-fade-in px-0">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <KpiCard
          title={`${t("overview.totalPortfolioValue")} (${baseCurrency})`}
          value={
            isLoading
              ? "—"
              : mask(formatCurrency(portfolioStats.totalValue, baseCurrency))
          }
          delta={isLoading ? 0 : portfolioStats.gainLossPercent}
          deltaAmount={
            isLoading
              ? "—"
              : mask(formatCurrency(portfolioStats.gainLoss, baseCurrency))
          }
          positive={portfolioStats.gainLoss >= 0}
          index={0}
          sparkline={sparklineData}
        />
        <KpiCard
          title={`${t("overview.totalGainLoss")} (${baseCurrency})`}
          value={
            isLoading
              ? "—"
              : mask(formatCurrency(portfolioStats.gainLoss, baseCurrency))
          }
          delta={isLoading ? 0 : portfolioStats.gainLossPercent}
          positive={portfolioStats.gainLoss >= 0}
          index={1}
        />
        <KpiCard
          title={t("overview.dailyChange")}
          value={
            isLoading
              ? "—"
              : dailyChangeStats.dailyChangeAmount !== null
                ? mask(
                    formatCurrency(
                      dailyChangeStats.dailyChangeAmount,
                      baseCurrency,
                    ),
                  )
                : "N/A"
          }
          delta={dailyChangeStats.dailyChangePercent ?? 0}
          subtitle={
            dailyChangeStats.dailyChangePercent === null
              ? t("overview.awaitingPriceData")
              : undefined
          }
          positive={(dailyChangeStats.dailyChangeAmount ?? 0) >= 0}
          index={2}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
        {/* Performance Chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="lg:col-span-2 bg-card border border-border rounded-xl p-4 sm:p-5 shadow-card"
        >
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-foreground">
                {t("overview.portfolioPerformance")}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {dateRange}
              </p>
            </div>
          </div>
          {snapsLoading ? (
            <div className="h-40 sm:h-56 flex items-center justify-center">
              <PageLoader />
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-40 sm:h-56 flex flex-col items-center justify-center text-center gap-2">
              <p className="text-muted-foreground text-sm font-medium">
                {t("overview.noHistoryYet")}
              </p>
              <p className="text-xs text-muted-foreground max-w-xs">
                {t("overview.noHistoryDesc")}
              </p>
            </div>
          ) : (
            <ResponsiveContainer
              width="100%"
              height={180}
              className="sm:!h-[220px] lg:!h-[240px]"
            >
              <AreaChart
                data={chartData}
                margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="portfolioGrad"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="oklch(0.72 0.2 155)"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="oklch(0.72 0.2 155)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="oklch(0.24 0.04 240)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "oklch(0.62 0.04 240)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "oklch(0.62 0.04 240)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={yAxisFormatter}
                />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.17 0.035 240)",
                    border: "1px solid oklch(0.24 0.04 240)",
                    borderRadius: "8px",
                    color: "oklch(0.93 0.015 240)",
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [
                    formatCurrency(v, baseCurrency),
                    t("overview.portfolioValue"),
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="oklch(0.72 0.2 155)"
                  strokeWidth={2}
                  fill="url(#portfolioGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Main Allocation Donut Chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-card"
        >
          <h2 className="text-sm sm:text-base font-bold text-foreground mb-4 sm:mb-5">
            {t("overview.assetAllocation")}
          </h2>
          {isLoading ? (
            <div className="h-40 sm:h-56 flex items-center justify-center">
              <PageLoader />
            </div>
          ) : portfolioStats.allocationByCategory.length === 0 ? (
            <div className="h-40 sm:h-56 flex flex-col items-center justify-center text-center">
              <p className="text-muted-foreground text-sm">
                {t("overview.noAssetsYet")}
              </p>
            </div>
          ) : (
            <>
              <ResponsiveContainer
                width="100%"
                height={160}
                className="sm:!h-[180px]"
              >
                <PieChart>
                  <Pie
                    data={
                      portfolioStats.pieAllocation.length > 0
                        ? portfolioStats.pieAllocation
                        : [
                            {
                              name: "empty",
                              displayName: "",
                              value: 1,
                              percentage: 100,
                            },
                          ]
                    }
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                  >
                    {(portfolioStats.pieAllocation.length > 0
                      ? portfolioStats.pieAllocation
                      : [{ name: "empty" }]
                    ).map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={
                          entry.name === "empty"
                            ? "oklch(0.24 0.04 240)"
                            : (CATEGORY_COLORS[entry.name] ??
                              "oklch(0.6 0.1 240)")
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={(props) => (
                      <AllocationTooltip
                        active={props.active}
                        payload={
                          props.payload as Array<{
                            name: string;
                            value: number;
                            payload: {
                              percentage: number;
                              displayName: string;
                            };
                          }>
                        }
                        baseCurrency={baseCurrency}
                        tValue={tValue}
                        tShare={tShare}
                        mask={mask}
                      />
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="text-center -mt-2 mb-3">
                <p className="text-xs text-muted-foreground">
                  {t("overview.total")} ({baseCurrency})
                </p>
                <p className="text-lg font-bold text-foreground">
                  {mask(
                    formatCurrency(
                      portfolioStats.totalValue,
                      baseCurrency,
                      true,
                    ),
                  )}
                </p>
              </div>
              {/* Legend — shows ALL categories including zero-value ones */}
              <div className="space-y-1.5">
                {portfolioStats.allocationByCategory.map((entry) => (
                  <div
                    key={entry.name}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{
                          background:
                            CATEGORY_COLORS[entry.name] ?? "oklch(0.6 0.1 240)",
                        }}
                      />
                      <span className="text-muted-foreground truncate">
                        {entry.displayName}
                      </span>
                    </div>
                    <span
                      className={`font-medium ml-2 flex-shrink-0 ${entry.value <= 0 ? "text-muted-foreground" : "text-foreground"}`}
                    >
                      {entry.value <= 0
                        ? t("overview.noHoldings", { defaultValue: "—" })
                        : `${entry.percentage.toFixed(1)}%`}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Per-Category Breakdown Pie Charts */}
      {categoryAssetBreakdowns.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="mb-4 sm:mb-6"
        >
          <div className="mb-3 sm:mb-4">
            <h2 className="text-sm sm:text-base font-bold text-foreground">
              {t("overview.categoryBreakdown")}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("overview.categoryBreakdownDesc")}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {categoryAssetBreakdowns.map((cat, catIdx) => (
              <motion.div
                key={cat.category}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.32 + catIdx * 0.08, duration: 0.35 }}
                className="bg-card border border-border rounded-xl p-4 shadow-card"
              >
                {/* Category header */}
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ background: cat.color }}
                  />
                  <h3 className="text-sm font-semibold text-foreground">
                    {cat.displayName}
                  </h3>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {cat.slices.length}{" "}
                    {cat.slices.length === 1
                      ? t("common.asset")
                      : t("common.assets")}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Pie chart — falls back to a muted ring when all values are 0 */}
                  <div className="flex-shrink-0">
                    <ResponsiveContainer width={120} height={120}>
                      <PieChart>
                        <Pie
                          data={
                            cat.slices.some((s) => s.value > 0)
                              ? cat.slices
                              : [
                                  {
                                    symbol: "empty",
                                    name: "",
                                    value: 1,
                                    percentage: 100,
                                  },
                                ]
                          }
                          cx="50%"
                          cy="50%"
                          innerRadius={32}
                          outerRadius={52}
                          paddingAngle={2}
                          dataKey="value"
                          nameKey="symbol"
                        >
                          {(cat.slices.some((s) => s.value > 0)
                            ? cat.slices
                            : [{ symbol: "empty" }]
                          ).map((slice, idx) => (
                            <Cell
                              key={slice.symbol}
                              fill={
                                slice.symbol === "empty"
                                  ? "oklch(0.24 0.04 240)"
                                  : SLICE_PALETTE[idx % SLICE_PALETTE.length]
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          content={(props) => (
                            <CategoryAssetTooltip
                              active={props.active}
                              payload={
                                props.payload as Array<{
                                  name: string;
                                  value: number;
                                  payload: {
                                    percentage: number;
                                    symbol: string;
                                  };
                                }>
                              }
                              baseCurrency={baseCurrency}
                              tValue={tValue}
                              tShare={tShare}
                              mask={mask}
                            />
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Slice legend */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {cat.slices.map((slice, idx) => (
                      <div
                        key={slice.symbol}
                        className="flex items-center justify-between text-xs gap-2"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{
                              background:
                                SLICE_PALETTE[idx % SLICE_PALETTE.length],
                            }}
                          />
                          <span className="text-muted-foreground font-mono truncate">
                            {slice.symbol}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span
                            className={`font-medium tabular-nums ${slice.value <= 0 ? "text-muted-foreground" : "text-foreground"}`}
                          >
                            {slice.value <= 0
                              ? "—"
                              : `${slice.percentage.toFixed(1)}%`}
                          </span>
                          <span className="text-muted-foreground tabular-nums hidden sm:inline">
                            {slice.value <= 0
                              ? t("overview.noHoldings", {
                                  defaultValue: "No holdings",
                                })
                              : formatCurrency(slice.value, baseCurrency, true)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Recent Transactions */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-card"
      >
        <h2 className="text-sm sm:text-base font-bold text-foreground mb-3 sm:mb-4">
          {t("overview.recentTransactions")}
        </h2>
        {txLoading ? (
          <PageLoader />
        ) : recentTx.length === 0 ? (
          <EmptyState
            title={t("overview.noTransactionsYet")}
            description={t("overview.noTransactionsDesc")}
            icon={ArrowLeftRight}
          />
        ) : (
          <div className="overflow-x-auto w-full">
            <Table className="min-w-[480px]">
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground text-xs whitespace-nowrap">
                    {t("overview.date")}
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs whitespace-nowrap">
                    {t("overview.typeCol")}
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs whitespace-nowrap">
                    {t("overview.assetCol")}
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right whitespace-nowrap">
                    {t("overview.qty")}
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right whitespace-nowrap hidden sm:table-cell">
                    {t("overview.priceCol")}
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right whitespace-nowrap">
                    {t("overview.amountCol")} ({baseCurrency})
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTx.map((tx, i) => {
                  const asset = assetById.get(String(tx.assetId));
                  const txCurrency = tx.currency ?? asset?.currency ?? "USD";
                  const amountInBase = convert(
                    tx.quantity * tx.price,
                    txCurrency,
                    baseCurrency,
                  );
                  return (
                    <TableRow
                      key={tx.id.toString()}
                      className="border-border hover:bg-muted/40"
                      data-ocid={`overview.transactions.item.${i + 1}`}
                    >
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(tx.date)}
                      </TableCell>
                      <TableCell>
                        <TxTypeBadge txType={tx.txType} />
                      </TableCell>
                      <TableCell className="text-xs font-mono font-medium text-foreground">
                        {assetMap.get(tx.assetId.toString()) ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-right text-foreground tabular-nums">
                        {tx.quantity.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground tabular-nums hidden sm:table-cell">
                        {formatCurrency(tx.price, txCurrency)}
                      </TableCell>
                      <TableCell
                        className={`text-xs text-right font-medium tabular-nums ${tx.txType === TxType.Buy || tx.txType === TxType.Deposit ? "text-fin-green" : "text-fin-red"}`}
                      >
                        {formatCurrency(amountInBase, baseCurrency)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
