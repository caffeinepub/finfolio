import { Category, TxType } from "@/backend.d";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface CategoryBadgeProps {
  category: Category;
  className?: string;
}

const CATEGORY_CLASS: Record<Category, string> = {
  [Category.Stock]: "bg-fin-blue/15 text-fin-blue border-fin-blue/20",
  [Category.Crypto]: "bg-fin-green/15 text-fin-green border-fin-green/20",
  [Category.Forex]: "bg-fin-purple/15 text-fin-purple border-fin-purple/20",
  [Category.Cash]: "bg-fin-orange/15 text-fin-orange border-fin-orange/20",
  [Category.Commodity]: "bg-yellow-400/15 text-yellow-400 border-yellow-400/20",
  [Category.RealEstate]: "bg-teal-400/15 text-teal-400 border-teal-400/20",
};

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  const { t } = useTranslation();
  const label = t(`badges.${category}` as Parameters<typeof t>[0]);
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
        CATEGORY_CLASS[category],
        className,
      )}
    >
      {label}
    </span>
  );
}

interface TxTypeBadgeProps {
  txType: TxType;
  className?: string;
}

const TX_TYPE_CLASS: Record<TxType, string> = {
  [TxType.Buy]: "bg-fin-green/15 text-fin-green border-fin-green/20",
  [TxType.Sell]: "bg-fin-red/15 text-fin-red border-fin-red/20",
  [TxType.Deposit]: "bg-fin-blue/15 text-fin-blue border-fin-blue/20",
  [TxType.Withdraw]: "bg-fin-orange/15 text-fin-orange border-fin-orange/20",
};

export function TxTypeBadge({ txType, className }: TxTypeBadgeProps) {
  const { t } = useTranslation();
  const label = t(`badges.${txType}` as Parameters<typeof t>[0]);
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
        TX_TYPE_CLASS[txType],
        className,
      )}
    >
      {label}
    </span>
  );
}
