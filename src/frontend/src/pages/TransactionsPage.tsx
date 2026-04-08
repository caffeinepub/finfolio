import type { Public__1 } from "@/backend.d";
import { TxType } from "@/backend.d";
import { TxTypeBadge } from "@/components/Badges";
import { EmptyState, PageLoader } from "@/components/LoadingStates";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TransactionWithCurrency } from "@/hooks/useQueries";
import {
  useAddTransaction,
  useDeleteTransaction,
  useGetAssets,
  useGetTransactions,
  useUpdateTransaction,
} from "@/hooks/useQueries";
import {
  CURRENCY_OPTIONS,
  dateInputToTimestamp,
  formatCurrency,
  formatDate,
  formatDateInput,
} from "@/utils/formatters";
import { ArrowLeftRight, Edit2, Plus, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

const TODAY = formatDateInput(Date.now());

type TxFormState = {
  txType: TxType;
  date: string;
  quantity: string;
  price: string;
  fee: string;
  note: string;
  currency: string;
};

const defaultForm: TxFormState = {
  txType: TxType.Buy,
  date: TODAY,
  quantity: "",
  price: "",
  fee: "0",
  note: "",
  currency: "USD",
};

/** Dropdown showing currency code + flag/symbol */
function CurrencySelect({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      id={id}
      className="mt-1 w-full h-10 px-3 rounded-md bg-muted border border-border text-foreground text-sm focus:outline-none focus:border-fin-green/50"
      data-ocid="transactions.currency.select"
    >
      {CURRENCY_OPTIONS.map((opt) => (
        <option key={opt.code} value={opt.code}>
          {opt.flag} {opt.label}
        </option>
      ))}
    </select>
  );
}

export default function TransactionsPage() {
  const { t } = useTranslation();
  const { data: transactions, isLoading: txLoading } = useGetTransactions();
  const { data: assets } = useGetAssets();
  const addTransaction = useAddTransaction();
  const deleteTransaction = useDeleteTransaction();
  const updateTransaction = useUpdateTransaction();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<TransactionWithCurrency | null>(null);
  const [filterType, setFilterType] = useState<string>("All");
  const [filterAsset, setFilterAsset] = useState<string>("all");

  const [addForm, setAddForm] = useState<{ assetId: string } & TxFormState>({
    assetId: "",
    ...defaultForm,
  });

  const [editingTransaction, setEditingTransaction] =
    useState<TransactionWithCurrency | null>(null);
  const [editForm, setEditForm] = useState<TxFormState>(defaultForm);

  // Map assetId -> asset object for quick lookup
  const assetById = useMemo(() => {
    const m = new Map<string, Public__1>();
    if (assets) {
      for (const a of assets) m.set(a.id.toString(), a);
    }
    return m;
  }, [assets]);

  const assetMap = useMemo(() => {
    const m = new Map<string, string>();
    if (assets) {
      for (const a of assets) m.set(a.id.toString(), a.symbol);
    }
    return m;
  }, [assets]);

  const filtered = useMemo(() => {
    if (!transactions) return [];
    return [...transactions]
      .sort((a, b) => Number(b.date) - Number(a.date))
      .filter((tx) => {
        if (filterType !== "All" && tx.txType !== filterType) return false;
        if (filterAsset !== "all" && tx.assetId.toString() !== filterAsset)
          return false;
        return true;
      });
  }, [transactions, filterType, filterAsset]);

  /** When an asset is selected in the add form, auto-set currency from that asset */
  const handleAddAssetChange = (assetIdStr: string) => {
    const asset = assetById.get(assetIdStr);
    setAddForm((p) => ({
      ...p,
      assetId: assetIdStr,
      currency: asset?.currency ?? p.currency,
    }));
  };

  const openAdd = () => {
    const firstAsset = assets && assets.length > 0 ? assets[0] : null;
    setAddForm({
      assetId: firstAsset ? firstAsset.id.toString() : "",
      txType: TxType.Buy,
      date: TODAY,
      quantity: "",
      price: "",
      fee: "0",
      note: "",
      currency: firstAsset?.currency ?? "USD",
    });
    setDialogOpen(true);
  };

  const openEdit = (tx: TransactionWithCurrency) => {
    const asset = assetById.get(tx.assetId.toString());
    setEditForm({
      txType: tx.txType,
      date: formatDateInput(tx.date),
      quantity: tx.quantity.toString(),
      price: tx.price.toString(),
      fee: tx.fee.toString(),
      note: tx.note,
      currency: tx.currency ?? asset?.currency ?? "USD",
    });
    setEditingTransaction(tx);
  };

  const closeEdit = () => {
    setEditingTransaction(null);
    setEditForm(defaultForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.assetId) {
      toast.error(t("transactions.pleaseSelectAsset"));
      return;
    }
    try {
      await addTransaction.mutateAsync({
        id: 0n,
        createdAt: BigInt(Date.now()) * 1_000_000n,
        assetId: BigInt(addForm.assetId),
        txType: addForm.txType,
        date: dateInputToTimestamp(addForm.date),
        quantity: Number.parseFloat(addForm.quantity) || 0,
        price: Number.parseFloat(addForm.price) || 0,
        fee: Number.parseFloat(addForm.fee) || 0,
        note: addForm.note,
        currency: addForm.currency,
      });
      toast.success(t("transactions.txAdded"));
      setDialogOpen(false);
    } catch {
      toast.error(t("transactions.failedToAdd"));
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;
    try {
      await updateTransaction.mutateAsync({
        id: editingTransaction.id,
        assetId: editingTransaction.assetId,
        createdAt: editingTransaction.createdAt,
        txType: editForm.txType,
        date: dateInputToTimestamp(editForm.date),
        quantity: Number.parseFloat(editForm.quantity) || 0,
        price: Number.parseFloat(editForm.price) || 0,
        fee: Number.parseFloat(editForm.fee) || 0,
        note: editForm.note,
        currency: editForm.currency,
      });
      toast.success(t("transactions.txUpdated"));
      closeEdit();
    } catch {
      toast.error(t("transactions.failedToUpdate"));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteTransaction.mutateAsync(deleteTarget.id);
      toast.success(t("transactions.txDeleted"));
      setDeleteTarget(null);
    } catch {
      toast.error(t("transactions.failedToDelete"));
    }
  };

  /** Resolve the display currency for a transaction: tx.currency → asset.currency → "USD" */
  const getTxCurrency = (tx: TransactionWithCurrency): string => {
    if (tx.currency) return tx.currency;
    return assetById.get(tx.assetId.toString())?.currency ?? "USD";
  };

  const filterLabels: Record<string, string> = {
    All: t("common.all"),
    [TxType.Buy]: t("badges.Buy"),
    [TxType.Sell]: t("badges.Sell"),
    [TxType.Deposit]: t("badges.Deposit"),
    [TxType.Withdraw]: t("badges.Withdraw"),
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Page header — flex-wrap on mobile */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4 sm:mb-6">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            {t("transactions.title")}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {t("transactions.subtitle")}
          </p>
        </div>
        <Button
          onClick={openAdd}
          className="bg-fin-green text-background hover:bg-fin-green/90 gap-2 min-h-[44px] shrink-0"
          data-ocid="transactions.add_button"
        >
          <Plus className="w-4 h-4" /> {t("transactions.addTransaction")}
        </Button>
      </div>

      {/* Filters — wrap nicely on mobile */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        {["All", TxType.Buy, TxType.Sell, TxType.Deposit, TxType.Withdraw].map(
          (type) => (
            <button
              type="button"
              key={type}
              onClick={() => setFilterType(type)}
              data-ocid="transactions.filter.tab"
              className={`px-3 py-2 min-h-[36px] rounded-full text-xs font-medium transition-colors ${
                filterType === type
                  ? "bg-fin-green/20 text-fin-green border border-fin-green/30"
                  : "bg-muted text-muted-foreground border border-transparent hover:text-foreground"
              }`}
            >
              {filterLabels[type] ?? type}
            </button>
          ),
        )}

        {assets && assets.length > 0 && (
          <select
            value={filterAsset}
            onChange={(e) => setFilterAsset(e.target.value)}
            className="h-9 px-2 rounded-full bg-muted border border-transparent text-xs text-muted-foreground focus:outline-none focus:border-fin-green/30"
            data-ocid="transactions.asset.select"
          >
            <option value="all">{t("common.allAssets")}</option>
            {assets.map((a) => (
              <option key={a.id.toString()} value={a.id.toString()}>
                {a.symbol}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
        {txLoading ? (
          <div className="p-6">
            <PageLoader />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title={t("transactions.noTransactionsFound")}
              description={t("transactions.noTransactionsDesc")}
              icon={ArrowLeftRight}
              action={
                <Button
                  onClick={openAdd}
                  className="bg-fin-green text-background hover:bg-fin-green/90"
                  data-ocid="transactions.empty_state"
                >
                  <Plus className="w-4 h-4 mr-1" />{" "}
                  {t("transactions.addTransaction")}
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto w-full rounded-lg">
            <Table className="min-w-[340px]">
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground text-xs pl-4 sm:pl-5">
                    {t("transactions.dateCol")}
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs">
                    {t("transactions.typeCol")}
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs">
                    {t("transactions.assetCol")}
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">
                    {t("transactions.quantityCol")}
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right hidden sm:table-cell">
                    {t("transactions.priceCol")}
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right hidden sm:table-cell">
                    {t("transactions.feeCol")}
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">
                    {t("transactions.amountCol")}
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs hidden sm:table-cell">
                    {t("transactions.noteCol")}
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right pr-4 sm:pr-5">
                    {t("transactions.actionsCol")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((tx, i) => {
                  const symbol = assetMap.get(tx.assetId.toString()) ?? "—";
                  const txCurrency = getTxCurrency(tx);
                  const amount = tx.quantity * tx.price;
                  const isBuyOrDeposit =
                    tx.txType === TxType.Buy || tx.txType === TxType.Deposit;
                  return (
                    <TableRow
                      key={tx.id.toString()}
                      className="border-border hover:bg-muted/30"
                      data-ocid={`transactions.item.${i + 1}`}
                    >
                      <TableCell className="pl-4 sm:pl-5 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(tx.date)}
                      </TableCell>
                      <TableCell>
                        <TxTypeBadge txType={tx.txType} />
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm font-bold font-mono text-foreground">
                        <div className="flex flex-col">
                          <span>{symbol}</span>
                          {txCurrency !== "USD" && (
                            <span className="text-[10px] text-muted-foreground font-normal">
                              {txCurrency}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs sm:text-sm text-foreground tabular-nums">
                        {tx.quantity.toLocaleString(undefined, {
                          maximumFractionDigits: 6,
                        })}
                      </TableCell>
                      <TableCell className="text-right text-xs sm:text-sm text-muted-foreground tabular-nums whitespace-nowrap hidden sm:table-cell">
                        {formatCurrency(tx.price, txCurrency)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground tabular-nums whitespace-nowrap hidden sm:table-cell">
                        {formatCurrency(tx.fee, txCurrency)}
                      </TableCell>
                      <TableCell
                        className={`text-right text-xs sm:text-sm font-medium tabular-nums whitespace-nowrap ${
                          isBuyOrDeposit ? "text-fin-green" : "text-fin-red"
                        }`}
                      >
                        {isBuyOrDeposit ? "+" : "-"}
                        {formatCurrency(amount, txCurrency)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[100px] truncate hidden sm:table-cell">
                        {tx.note || "—"}
                      </TableCell>
                      <TableCell className="text-right pr-4 sm:pr-5">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 sm:h-7 sm:w-7 text-muted-foreground hover:text-yellow-400 transition-colors"
                            onClick={() => openEdit(tx)}
                            data-ocid={`transactions.edit_button.${i + 1}`}
                            aria-label={t("transactions.editTransaction")}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 sm:h-7 sm:w-7 text-muted-foreground hover:text-fin-red transition-colors"
                            onClick={() => setDeleteTarget(tx)}
                            data-ocid={`transactions.delete_button.${i + 1}`}
                            aria-label={t("common.delete")}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
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

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="bg-card border-border w-full max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto"
          data-ocid="transactions.dialog"
        >
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {t("transactions.addTransaction")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-foreground text-sm">
                  {t("transactions.assetLabel")} *
                </Label>
                <select
                  value={addForm.assetId}
                  onChange={(e) => handleAddAssetChange(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-md bg-muted border border-border text-foreground text-sm"
                  required
                  data-ocid="transactions.asset_select.select"
                >
                  <option value="">{t("transactions.selectAsset")}</option>
                  {assets?.map((a) => (
                    <option key={a.id.toString()} value={a.id.toString()}>
                      {a.symbol} — {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-foreground text-sm">
                  {t("transactions.typeLabel")} *
                </Label>
                <select
                  value={addForm.txType}
                  onChange={(e) =>
                    setAddForm((p) => ({
                      ...p,
                      txType: e.target.value as TxType,
                    }))
                  }
                  className="mt-1 w-full h-10 px-3 rounded-md bg-muted border border-border text-foreground text-sm"
                  data-ocid="transactions.type.select"
                >
                  <option value={TxType.Buy}>{t("badges.Buy")}</option>
                  <option value={TxType.Sell}>{t("badges.Sell")}</option>
                  <option value={TxType.Deposit}>{t("badges.Deposit")}</option>
                  <option value={TxType.Withdraw}>
                    {t("badges.Withdraw")}
                  </option>
                </select>
              </div>
            </div>

            <div>
              <Label className="text-foreground text-sm">
                {t("transactions.currencyLabel")} *
              </Label>
              <CurrencySelect
                value={addForm.currency}
                onChange={(v) => setAddForm((p) => ({ ...p, currency: v }))}
                id="add-currency"
              />
              {addForm.currency === "VND" && (
                <p className="text-[11px] text-fin-green mt-1">
                  {t("transactions.vndNote")}
                </p>
              )}
            </div>

            <div>
              <Label className="text-foreground text-sm">
                {t("transactions.dateLabel")} *
              </Label>
              <Input
                type="date"
                value={addForm.date}
                onChange={(e) =>
                  setAddForm((p) => ({ ...p, date: e.target.value }))
                }
                className="mt-1 bg-muted border-border"
                required
                data-ocid="transactions.date.input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-foreground text-sm">
                  {t("transactions.quantityLabel")} *
                </Label>
                <Input
                  type="number"
                  step="any"
                  value={addForm.quantity}
                  onChange={(e) =>
                    setAddForm((p) => ({ ...p, quantity: e.target.value }))
                  }
                  placeholder="0.00"
                  className="mt-1 bg-muted border-border"
                  required
                  data-ocid="transactions.quantity.input"
                />
              </div>
              <div>
                <Label className="text-foreground text-sm">
                  {t("transactions.priceLabel")} ({addForm.currency}) *
                </Label>
                <Input
                  type="number"
                  step="any"
                  value={addForm.price}
                  onChange={(e) =>
                    setAddForm((p) => ({ ...p, price: e.target.value }))
                  }
                  placeholder={addForm.currency === "VND" ? "0" : "0.00"}
                  className="mt-1 bg-muted border-border"
                  required
                  data-ocid="transactions.price.input"
                />
              </div>
            </div>
            <div>
              <Label className="text-foreground text-sm">
                {t("transactions.feeLabel")} ({addForm.currency})
              </Label>
              <Input
                type="number"
                step="any"
                value={addForm.fee}
                onChange={(e) =>
                  setAddForm((p) => ({ ...p, fee: e.target.value }))
                }
                placeholder="0"
                className="mt-1 bg-muted border-border"
                data-ocid="transactions.fee.input"
              />
            </div>
            <div>
              <Label className="text-foreground text-sm">
                {t("transactions.noteLabel")}
              </Label>
              <Input
                value={addForm.note}
                onChange={(e) =>
                  setAddForm((p) => ({ ...p, note: e.target.value }))
                }
                placeholder={t("common.optional")}
                className="mt-1 bg-muted border-border"
                data-ocid="transactions.note.input"
              />
            </div>
            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogOpen(false)}
                className="text-muted-foreground w-full sm:w-auto"
                data-ocid="transactions.cancel_button"
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={addTransaction.isPending}
                className="bg-fin-green text-background hover:bg-fin-green/90 w-full sm:w-auto"
                data-ocid="transactions.submit_button"
              >
                {addTransaction.isPending
                  ? t("transactions.addingTx")
                  : t("transactions.addTransaction")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingTransaction}
        onOpenChange={(o) => !o && closeEdit()}
      >
        <DialogContent
          className="bg-card border-border w-full max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto"
          data-ocid="transactions.edit_dialog"
        >
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-foreground">
                {t("transactions.editTransaction")}
              </DialogTitle>
              {editingTransaction && (
                <TxTypeBadge txType={editingTransaction.txType} />
              )}
            </div>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {/* Asset — read-only */}
            <div>
              <Label className="text-foreground text-sm">
                {t("transactions.assetLabel")}
              </Label>
              <div className="mt-1 w-full h-10 px-3 rounded-md bg-muted/50 border border-border text-muted-foreground text-sm flex items-center font-mono font-bold">
                {editingTransaction
                  ? (assetMap.get(editingTransaction.assetId.toString()) ?? "—")
                  : "—"}
              </div>
            </div>

            <div>
              <Label className="text-foreground text-sm">
                {t("transactions.currencyLabel")} *
              </Label>
              <CurrencySelect
                value={editForm.currency}
                onChange={(v) => setEditForm((p) => ({ ...p, currency: v }))}
                id="edit-currency"
              />
              {editForm.currency === "VND" && (
                <p className="text-[11px] text-fin-green mt-1">
                  {t("transactions.vndNoteEdit")}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-foreground text-sm">
                  {t("transactions.typeLabel")} *
                </Label>
                <select
                  value={editForm.txType}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      txType: e.target.value as TxType,
                    }))
                  }
                  className="mt-1 w-full h-10 px-3 rounded-md bg-muted border border-border text-foreground text-sm focus:outline-none focus:border-fin-green/50"
                  data-ocid="transactions.edit.type.select"
                >
                  <option value={TxType.Buy}>{t("badges.Buy")}</option>
                  <option value={TxType.Sell}>{t("badges.Sell")}</option>
                  <option value={TxType.Deposit}>{t("badges.Deposit")}</option>
                  <option value={TxType.Withdraw}>
                    {t("badges.Withdraw")}
                  </option>
                </select>
              </div>
              <div>
                <Label className="text-foreground text-sm">
                  {t("transactions.dateLabel")} *
                </Label>
                <Input
                  type="date"
                  value={editForm.date}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, date: e.target.value }))
                  }
                  className="mt-1 bg-muted border-border"
                  required
                  data-ocid="transactions.edit.date.input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-foreground text-sm">
                  {t("transactions.quantityLabel")} *
                </Label>
                <Input
                  type="number"
                  step="any"
                  value={editForm.quantity}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, quantity: e.target.value }))
                  }
                  placeholder="0.00"
                  className="mt-1 bg-muted border-border"
                  required
                  data-ocid="transactions.edit.quantity.input"
                />
              </div>
              <div>
                <Label className="text-foreground text-sm">
                  {t("transactions.priceLabel")} ({editForm.currency}) *
                </Label>
                <Input
                  type="number"
                  step="any"
                  value={editForm.price}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, price: e.target.value }))
                  }
                  placeholder={editForm.currency === "VND" ? "0" : "0.00"}
                  className="mt-1 bg-muted border-border"
                  required
                  data-ocid="transactions.edit.price.input"
                />
              </div>
            </div>

            <div>
              <Label className="text-foreground text-sm">
                {t("transactions.feeLabel")} ({editForm.currency})
              </Label>
              <Input
                type="number"
                step="any"
                value={editForm.fee}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, fee: e.target.value }))
                }
                placeholder="0"
                className="mt-1 bg-muted border-border"
                data-ocid="transactions.edit.fee.input"
              />
            </div>

            <div>
              <Label className="text-foreground text-sm">
                {t("transactions.noteLabel")}
              </Label>
              <Input
                value={editForm.note}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, note: e.target.value }))
                }
                placeholder={t("common.optional")}
                className="mt-1 bg-muted border-border"
                data-ocid="transactions.edit.note.input"
              />
            </div>

            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={closeEdit}
                className="text-muted-foreground w-full sm:w-auto"
                data-ocid="transactions.edit.cancel_button"
              >
                {t("transactions.cancelBtn")}
              </Button>
              <Button
                type="submit"
                disabled={updateTransaction.isPending}
                className="bg-fin-green text-background hover:bg-fin-green/90 w-full sm:w-auto"
                data-ocid="transactions.edit.submit_button"
              >
                {updateTransaction.isPending
                  ? t("transactions.savingBtn")
                  : t("transactions.saveChanges")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent className="bg-card border-border w-full max-w-[calc(100vw-2rem)] sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              {t("transactions.deleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("transactions.deleteDesc")}{" "}
              <strong className="text-foreground">
                {deleteTarget?.txType}
              </strong>{" "}
              {t("transactions.deleteDescSuffix")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-border"
              data-ocid="transactions.delete.cancel_button"
            >
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-ocid="transactions.delete.confirm_button"
            >
              {deleteTransaction.isPending
                ? t("common.deleting")
                : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
