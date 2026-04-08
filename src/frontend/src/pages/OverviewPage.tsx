import { TxType } from "@/backend.d";
import type { Public__1 } from "@/backend.d";
import { Category } from "@/backend.d";
import { TxTypeBadge } from "@/components/Badges";
import KpiCard from "@/components/KpiCard";
import { EmptyState, PageLoader } from "@/components/LoadingStates";
import TopBar from "@/components/TopBar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePrices } from "@/contexts/PriceFeedContext";
import type { OnPricesUpdatedFn } from "@/contexts/PriceFeedContext";
import {
  useAddSnapshot,
  useGetAssets,
  useGetSnapshots,
  useGetTransactions,
} from "@/hooks/useQueries";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { ArrowLeftRight } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
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
};

interface Props {
  dateRange: string;
  onDateRangeChange: (range: string) => void;
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

/** Calculate per-asset holdings (quantity) from transactions */
function calcHoldingsQuantity(
  assets: Public__1[],
  transactions: {
    assetId: bigint;
    txType: TxType;
    quantity: number;
    price: number;
    fee: number;
  }[],
): Map<bigint, { quantity: number; totalCost: number }> {
  const map = new Map<bigint, { quantity: number; totalCost: number }>();
  for (const asset of assets) {
    map.set(asset.id, { quantity: 0, totalCost: 0 });
  }
  for (const tx of transactions) {
    const current = map.get(tx.assetId) ?? { quantity: 0, totalCost: 0 };
    if (tx.txType === TxType.Buy || tx.txType === TxType.Deposit) {
      map.set(tx.assetId, {
        quantity: current.quantity + tx.quantity,
        totalCost: current.totalCost + tx.quantity * tx.price + tx.fee,
      });
    } else if (tx.txType === TxType.Sell || tx.txType === TxType.Withdraw) {
      map.set(tx.assetId, {
        quantity: current.quantity - tx.quantity,
        totalCost: current.totalCost,
      });
    }
  }
  return map;
}

const SNAPSHOT_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes — module-level constant

export default function OverviewPage({ dateRange, onDateRangeChange }: Props) {
  const rangeMs = getDateRangeMs(dateRange);

  // ICP backend stores timestamps as nanoseconds — convert ms → ns by × 1_000_000
  // Memoize on dateRange label to avoid recalculating on every render tick,
  // which would cause the query key to change constantly and loop.
  const NS_PER_MS = 1_000_000n;
  const { startDate, endDate } = useMemo(() => {
    const now = Date.now();
    return {
      startDate: BigInt(now - rangeMs) * NS_PER_MS,
      endDate: BigInt(now) * NS_PER_MS,
    };
    // re-compute only when the range label (and derived rangeMs) changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeMs]); // stable: rangeMs only changes when dateRange label changes

  const { data: transactions, isLoading: txLoading } = useGetTransactions();
  const { data: assets, isLoading: assetsLoading } = useGetAssets();
  const { data: snapshots, isLoading: snapsLoading } = useGetSnapshots(
    startDate,
    endDate,
  );
  const { prices, isLoading: pricesLoading, onPricesUpdated } = usePrices();
  const addSnapshot = useAddSnapshot();

  // Track whether we've already saved a snapshot in this session (throttle per 5 min)
  const lastSnapshotTimeRef = useRef<number>(0);

  // Build asset map for display in recent transactions
  const assetMap = useMemo(() => {
    const m = new Map<string, string>();
    if (assets) {
      for (const a of assets) m.set(a.id.toString(), a.symbol);
    }
    return m;
  }, [assets]);

  // Calculate holdings quantity map from transactions
  const holdingsMap = useMemo(() => {
    if (!assets || !transactions)
      return new Map<bigint, { quantity: number; totalCost: number }>();
    return calcHoldingsQuantity(assets, transactions);
  }, [assets, transactions]);

  // Calculate live portfolio statistics from assets + live prices + transactions
  const portfolioStats = useMemo(() => {
    if (!assets || assets.length === 0) {
      return {
        totalValue: 0,
        totalCost: 0,
        gainLoss: 0,
        gainLossPercent: 0,
        allocationByCategory: [] as {
          name: string;
          value: number;
          percentage: number;
        }[],
      };
    }

    let totalValue = 0;
    let totalCost = 0;
    const categoryValues: Record<string, number> = {};

    for (const asset of assets) {
      const holding = holdingsMap.get(asset.id);
      const quantity = holding?.quantity ?? 0;
      const cost = holding?.totalCost ?? 0;

      let currentValue: number;
      if (asset.category === Category.Cash) {
        // Cash: manualPrice is the total cash value (no quantity needed)
        currentValue = asset.manualPrice;
        totalCost += asset.manualPrice; // cost basis = current value for cash
      } else {
        const entry = prices[asset.symbol];
        const livePrice = entry?.price ?? asset.manualPrice;
        currentValue = quantity * livePrice;
        totalCost += cost;
      }

      totalValue += currentValue;
      const catKey = asset.category as string;
      categoryValues[catKey] = (categoryValues[catKey] ?? 0) + currentValue;
    }

    const gainLoss = totalValue - totalCost;
    const gainLossPercent = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0;

    const allocationByCategory = Object.entries(categoryValues)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({
        name,
        value,
        percentage: totalValue > 0 ? (value / totalValue) * 100 : 0,
      }));

    return {
      totalValue,
      totalCost,
      gainLoss,
      gainLossPercent,
      allocationByCategory,
    };
  }, [assets, holdingsMap, prices]);

  // Weighted average 24h change across all live-priced assets
  const dailyChangeStats = useMemo(() => {
    if (!assets || assets.length === 0 || portfolioStats.totalValue === 0) {
      return { dailyChangeAmount: null, dailyChangePercent: null };
    }

    let weightedChange = 0;
    let hasAnyChange = false;

    for (const asset of assets) {
      if (asset.category === Category.Cash) continue;
      const entry = prices[asset.symbol];
      if (!entry || entry.change24h === 0) continue;
      const holding = holdingsMap.get(asset.id);
      const quantity = holding?.quantity ?? 0;
      const currentValue = quantity * entry.price;
      if (currentValue > 0 && portfolioStats.totalValue > 0) {
        weightedChange +=
          entry.change24h * (currentValue / portfolioStats.totalValue);
        hasAnyChange = true;
      }
    }

    if (!hasAnyChange)
      return { dailyChangeAmount: null, dailyChangePercent: null };

    const dailyChangeAmount =
      portfolioStats.totalValue * (weightedChange / 100);
    return { dailyChangeAmount, dailyChangePercent: weightedChange };
  }, [assets, prices, holdingsMap, portfolioStats.totalValue]);

  // Chart data from snapshots
  const chartData = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return [];
    return snapshots
      .slice()
      .sort((a, b) => Number(a.date) - Number(b.date))
      .map((s) => ({
        date: formatDate(s.date),
        value: s.totalValue,
      }));
  }, [snapshots]);

  // Sparkline from recent snapshots
  const sparklineData = useMemo(() => {
    if (!snapshots || snapshots.length < 2) return [];
    return snapshots
      .slice()
      .sort((a, b) => Number(a.date) - Number(b.date))
      .slice(-10)
      .map((s) => s.totalValue);
  }, [snapshots]);

  // Recent transactions (sorted by date desc, top 8)
  const recentTx = useMemo(() => {
    if (!transactions) return [];
    return [...transactions]
      .sort((a, b) => Number(b.date) - Number(a.date))
      .slice(0, 8);
  }, [transactions]);

  // Record a portfolio snapshot whenever prices update
  // Throttled to once per 5 minutes; only fires when user has assets + transactions
  const handlePricesUpdated: OnPricesUpdatedFn = useCallback(
    (updatedPrices, updatedAssets) => {
      if (!updatedAssets || updatedAssets.length === 0) return;
      if (!transactions || transactions.length === 0) return;

      const elapsed = Date.now() - lastSnapshotTimeRef.current;
      if (elapsed < SNAPSHOT_THROTTLE_MS) return;

      // Calculate current total value with updated prices
      const hMap = calcHoldingsQuantity(updatedAssets, transactions);
      let total = 0;
      for (const asset of updatedAssets) {
        if (asset.category === Category.Cash) {
          total += asset.manualPrice;
        } else {
          const entry = updatedPrices[asset.symbol];
          const livePrice = entry?.price ?? asset.manualPrice;
          const holding = hMap.get(asset.id);
          total += (holding?.quantity ?? 0) * livePrice;
        }
      }

      if (total <= 0) return;

      lastSnapshotTimeRef.current = Date.now();
      const ts = BigInt(Date.now()) * 1_000_000n; // nanoseconds for ICP

      addSnapshot.mutate({
        id: 0n,
        totalValue: total,
        date: ts,
        createdAt: ts,
      });
    },
    [transactions, addSnapshot],
  );

  // Subscribe to price updates for snapshot recording
  useEffect(() => {
    const unsubscribe = onPricesUpdated(handlePricesUpdated);
    return unsubscribe;
  }, [onPricesUpdated, handlePricesUpdated]);

  const currency = "USD";
  const isLoading = assetsLoading || txLoading || pricesLoading;

  return (
    <div className="animate-fade-in">
      <TopBar dateRange={dateRange} onDateRangeChange={onDateRangeChange} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KpiCard
          title="Total Portfolio Value"
          value={
            isLoading
              ? "—"
              : formatCurrency(portfolioStats.totalValue, currency)
          }
          delta={isLoading ? 0 : portfolioStats.gainLossPercent}
          deltaAmount={
            isLoading ? "—" : formatCurrency(portfolioStats.gainLoss, currency)
          }
          positive={portfolioStats.gainLoss >= 0}
          index={0}
          sparkline={sparklineData}
        />
        <KpiCard
          title="Total Gain / Loss"
          value={
            isLoading ? "—" : formatCurrency(portfolioStats.gainLoss, currency)
          }
          delta={isLoading ? 0 : portfolioStats.gainLossPercent}
          positive={portfolioStats.gainLoss >= 0}
          index={1}
        />
        <KpiCard
          title="Daily Change"
          value={
            isLoading
              ? "—"
              : dailyChangeStats.dailyChangeAmount !== null
                ? formatCurrency(dailyChangeStats.dailyChangeAmount, currency)
                : "N/A"
          }
          delta={dailyChangeStats.dailyChangePercent ?? 0}
          subtitle={
            dailyChangeStats.dailyChangePercent === null
              ? "Awaiting price data"
              : undefined
          }
          positive={(dailyChangeStats.dailyChangeAmount ?? 0) >= 0}
          index={2}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Performance Chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="lg:col-span-2 bg-card border border-border rounded-xl p-5 shadow-card"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold text-foreground">
                Portfolio Performance
              </h2>
              <p className="text-sm text-muted-foreground">{dateRange}</p>
            </div>
          </div>
          {snapsLoading ? (
            <div className="h-56 flex items-center justify-center">
              <PageLoader />
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-center gap-2">
              <p className="text-muted-foreground text-sm font-medium">
                No performance history yet.
              </p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Data will be recorded automatically as you use the app. Come
                back after a few minutes to see your portfolio chart.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
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
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
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
                    formatCurrency(v, currency),
                    "Portfolio Value",
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

        {/* Allocation Chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="bg-card border border-border rounded-xl p-5 shadow-card"
        >
          <h2 className="text-base font-bold text-foreground mb-5">
            Asset Allocation
          </h2>
          {isLoading ? (
            <div className="h-56 flex items-center justify-center">
              <PageLoader />
            </div>
          ) : portfolioStats.allocationByCategory.length === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-center">
              <p className="text-muted-foreground text-sm">No assets yet.</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={portfolioStats.allocationByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {portfolioStats.allocationByCategory.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={
                          CATEGORY_COLORS[entry.name] ?? "oklch(0.6 0.1 240)"
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "oklch(0.17 0.035 240)",
                      border: "1px solid oklch(0.24 0.04 240)",
                      borderRadius: "8px",
                      color: "oklch(0.93 0.015 240)",
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [
                      formatCurrency(v, currency),
                      "Value",
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="text-center -mt-2 mb-3">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold text-foreground">
                  {formatCurrency(portfolioStats.totalValue, currency, true)}
                </p>
              </div>
              <div className="space-y-1.5">
                {portfolioStats.allocationByCategory.map((entry) => (
                  <div
                    key={entry.name}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          background:
                            CATEGORY_COLORS[entry.name] ?? "oklch(0.6 0.1 240)",
                        }}
                      />
                      <span className="text-muted-foreground">
                        {entry.name}
                      </span>
                    </div>
                    <span className="text-foreground font-medium">
                      {entry.percentage.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Recent Transactions */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="bg-card border border-border rounded-xl p-5 shadow-card"
      >
        <h2 className="text-base font-bold text-foreground mb-4">
          Recent Transactions
        </h2>
        {txLoading ? (
          <PageLoader />
        ) : recentTx.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            description="Add your first transaction to start tracking your portfolio."
            icon={ArrowLeftRight}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground text-xs">
                    Date
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs">
                    Type
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs">
                    Asset
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">
                    Qty
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">
                    Price
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">
                    Amount
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTx.map((tx, i) => (
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
                    <TableCell className="text-xs text-right text-muted-foreground tabular-nums">
                      {formatCurrency(tx.price, currency)}
                    </TableCell>
                    <TableCell
                      className={`text-xs text-right font-medium tabular-nums ${
                        tx.txType === TxType.Buy || tx.txType === TxType.Deposit
                          ? "text-fin-green"
                          : "text-fin-red"
                      }`}
                    >
                      {formatCurrency(tx.quantity * tx.price, currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
