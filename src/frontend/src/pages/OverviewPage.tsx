import { TxType } from "@/backend.d";
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
import {
  useGetAssets,
  useGetPortfolioSummary,
  useGetSnapshots,
  useGetTransactions,
} from "@/hooks/useQueries";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { ArrowLeftRight } from "lucide-react";
import { motion } from "motion/react";
import { useMemo } from "react";
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

export default function OverviewPage({ dateRange, onDateRangeChange }: Props) {
  const now = Date.now();
  const rangeMs = getDateRangeMs(dateRange);
  const startDate = BigInt(now - rangeMs);
  const endDate = BigInt(now);

  const { data: summary, isLoading: summaryLoading } = useGetPortfolioSummary();
  const { data: transactions, isLoading: txLoading } = useGetTransactions();
  const { data: snapshots, isLoading: snapsLoading } = useGetSnapshots(
    startDate,
    endDate,
  );
  const { data: assets } = useGetAssets();

  const assetMap = useMemo(() => {
    const m = new Map<string, string>();
    if (assets) {
      for (const a of assets) m.set(a.id.toString(), a.symbol);
    }
    return m;
  }, [assets]);

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

  const allocationData = useMemo(() => {
    if (!summary) return [];
    return summary.allocation.map((a) => ({
      name: a.category as string,
      value: a.value,
      percentage: a.percentage,
    }));
  }, [summary]);

  const recentTx = useMemo(() => {
    if (!transactions) return [];
    return [...transactions]
      .sort((a, b) => Number(b.date) - Number(a.date))
      .slice(0, 8);
  }, [transactions]);

  const sparklineData = useMemo(() => {
    if (!snapshots || snapshots.length < 2) return [];
    return snapshots
      .slice()
      .sort((a, b) => Number(a.date) - Number(b.date))
      .slice(-10)
      .map((s) => s.totalValue);
  }, [snapshots]);

  const currency = "USD";

  return (
    <div className="animate-fade-in">
      <TopBar dateRange={dateRange} onDateRangeChange={onDateRangeChange} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KpiCard
          title="Total Portfolio Value"
          value={formatCurrency(summary?.totalValue ?? 0, currency)}
          delta={summary?.totalGainLossPercent ?? 0}
          deltaAmount={formatCurrency(summary?.totalGainLoss ?? 0, currency)}
          positive={(summary?.totalGainLoss ?? 0) >= 0}
          index={0}
          sparkline={sparklineData}
        />
        <KpiCard
          title="Total Gain / Loss"
          value={formatCurrency(summary?.totalGainLoss ?? 0, currency)}
          delta={summary?.totalGainLossPercent ?? 0}
          positive={(summary?.totalGainLoss ?? 0) >= 0}
          index={1}
        />
        <KpiCard
          title="Daily Change"
          value={formatCurrency(summary?.dailyChange ?? 0, currency)}
          delta={
            summary?.totalValue
              ? (summary.dailyChange / summary.totalValue) * 100
              : 0
          }
          positive={(summary?.dailyChange ?? 0) >= 0}
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
            <div className="h-56 flex flex-col items-center justify-center text-center">
              <p className="text-muted-foreground text-sm">
                No snapshot data yet.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Add transactions to start tracking performance.
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
          {summaryLoading ? (
            <div className="h-56 flex items-center justify-center">
              <PageLoader />
            </div>
          ) : allocationData.length === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-center">
              <p className="text-muted-foreground text-sm">No assets yet.</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={allocationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {allocationData.map((entry) => (
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
                  {formatCurrency(summary?.totalValue ?? 0, currency, true)}
                </p>
              </div>
              <div className="space-y-1.5">
                {allocationData.map((entry) => (
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
