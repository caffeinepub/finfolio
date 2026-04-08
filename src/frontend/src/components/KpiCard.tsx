import { cn } from "@/lib/utils";
import { formatPercent } from "@/utils/formatters";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { motion } from "motion/react";

interface Props {
  title: string;
  value: string;
  delta?: number;
  deltaAmount?: string;
  subtitle?: string;
  positive?: boolean;
  neutral?: boolean;
  index?: number;
  sparkline?: number[];
}

export default function KpiCard({
  title,
  value,
  delta,
  deltaAmount,
  subtitle,
  positive,
  neutral,
  index = 0,
  sparkline,
}: Props) {
  const isPositive = neutral
    ? null
    : (positive ?? (delta !== undefined ? delta >= 0 : true));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className="bg-card border border-border rounded-xl p-3 sm:p-4 lg:p-5 shadow-card relative overflow-hidden"
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-muted/20 pointer-events-none" />

      <div className="relative flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm text-muted-foreground font-medium mb-1 truncate">
            {title}
          </p>
          <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">
            {value}
          </p>

          {delta !== undefined && (
            <div
              className={cn(
                "flex items-center gap-1.5 mt-1.5 sm:mt-2 text-xs sm:text-sm font-medium flex-wrap",
                neutral
                  ? "text-muted-foreground"
                  : isPositive
                    ? "text-fin-green"
                    : "text-fin-red",
              )}
            >
              {neutral ? (
                <Minus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              ) : isPositive ? (
                <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              ) : (
                <TrendingDown className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              )}
              <span>{formatPercent(delta)}</span>
              {deltaAmount && (
                <span className="text-muted-foreground font-normal">
                  ({deltaAmount})
                </span>
              )}
            </div>
          )}

          {subtitle && delta === undefined && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>

        {/* Sparkline — hidden on very small screens */}
        {sparkline && sparkline.length > 0 && (
          <div className="ml-2 sm:ml-3 hidden xs:block">
            <MiniSparkline data={sparkline} positive={isPositive !== false} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

function MiniSparkline({
  data,
  positive,
}: {
  data: number[];
  positive: boolean;
}) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 36;
  const pad = 2;

  const points = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (v - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const lastX = pad + ((data.length - 1) / (data.length - 1)) * (w - pad * 2);
  const fillPoints = `${pad},${h - pad} ${points} ${lastX},${h - pad}`;

  const color = positive ? "oklch(0.72 0.2 155)" : "oklch(0.62 0.22 25)";

  return (
    <svg
      width={w}
      height={h}
      className="overflow-visible"
      aria-label="Sparkline chart"
      role="img"
    >
      <title>Portfolio sparkline</title>
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill="url(#sparkGrad)" />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
