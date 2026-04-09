import { Category, TxType } from "@/backend.d";
import { cn } from "@/lib/utils";

interface CategoryBadgeProps {
  category: Category;
  className?: string;
}

const CATEGORY_CONFIG: Record<Category, { label: string; className: string }> =
  {
    [Category.Stock]: {
      label: "Stock",
      className: "bg-fin-blue/15 text-fin-blue border-fin-blue/20",
    },
    [Category.Crypto]: {
      label: "Crypto",
      className: "bg-fin-green/15 text-fin-green border-fin-green/20",
    },
    [Category.Forex]: {
      label: "Forex",
      className: "bg-fin-purple/15 text-fin-purple border-fin-purple/20",
    },
    [Category.Cash]: {
      label: "Cash",
      className: "bg-fin-orange/15 text-fin-orange border-fin-orange/20",
    },
  };

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  const config = CATEGORY_CONFIG[category];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}

interface TxTypeBadgeProps {
  txType: TxType;
  className?: string;
}

const TX_TYPE_CONFIG: Record<TxType, { label: string; className: string }> = {
  [TxType.Buy]: {
    label: "Buy",
    className: "bg-fin-green/15 text-fin-green border-fin-green/20",
  },
  [TxType.Sell]: {
    label: "Sell",
    className: "bg-fin-red/15 text-fin-red border-fin-red/20",
  },
  [TxType.Deposit]: {
    label: "Deposit",
    className: "bg-fin-blue/15 text-fin-blue border-fin-blue/20",
  },
  [TxType.Withdraw]: {
    label: "Withdraw",
    className: "bg-fin-orange/15 text-fin-orange border-fin-orange/20",
  },
};

export function TxTypeBadge({ txType, className }: TxTypeBadgeProps) {
  const config = TX_TYPE_CONFIG[txType];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
