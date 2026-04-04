import type { Transaction } from "@/backend.d";
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
import {
  useAddTransaction,
  useDeleteTransaction,
  useGetAssets,
  useGetTransactions,
} from "@/hooks/useQueries";
import {
  dateInputToTimestamp,
  formatDate,
  formatDateInput,
} from "@/utils/formatters";
import { ArrowLeftRight, Plus, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const TODAY = formatDateInput(Date.now());

export default function TransactionsPage() {
  const { data: transactions, isLoading: txLoading } = useGetTransactions();
  const { data: assets } = useGetAssets();
  const addTransaction = useAddTransaction();
  const deleteTransaction = useDeleteTransaction();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [filterType, setFilterType] = useState<string>("All");
  const [filterAsset, setFilterAsset] = useState<string>("all");

  const [form, setForm] = useState({
    assetId: "",
    txType: TxType.Buy as TxType,
    date: TODAY,
    quantity: "",
    price: "",
    fee: "0",
    note: "",
  });

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

  const openAdd = () => {
    setForm({
      assetId: assets && assets.length > 0 ? assets[0].id.toString() : "",
      txType: TxType.Buy,
      date: TODAY,
      quantity: "",
      price: "",
      fee: "0",
      note: "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.assetId) {
      toast.error("Please select an asset");
      return;
    }
    try {
      await addTransaction.mutateAsync({
        id: 0n,
        createdAt: BigInt(Date.now()),
        assetId: BigInt(form.assetId),
        txType: form.txType,
        date: dateInputToTimestamp(form.date),
        quantity: Number.parseFloat(form.quantity) || 0,
        price: Number.parseFloat(form.price) || 0,
        fee: Number.parseFloat(form.fee) || 0,
        note: form.note,
      });
      toast.success("Transaction added");
      setDialogOpen(false);
    } catch {
      toast.error("Failed to add transaction");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteTransaction.mutateAsync(deleteTarget.id);
      toast.success("Transaction deleted");
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete transaction");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Full transaction history
          </p>
        </div>
        <Button
          onClick={openAdd}
          className="bg-fin-green text-background hover:bg-fin-green/90 gap-2"
          data-ocid="transactions.add_button"
        >
          <Plus className="w-4 h-4" /> Add Transaction
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {["All", TxType.Buy, TxType.Sell, TxType.Deposit, TxType.Withdraw].map(
          (t) => (
            <button
              type="button"
              key={t}
              onClick={() => setFilterType(t)}
              data-ocid="transactions.filter.tab"
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filterType === t
                  ? "bg-fin-green/20 text-fin-green border border-fin-green/30"
                  : "bg-muted text-muted-foreground border border-transparent hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ),
        )}

        {assets && assets.length > 0 && (
          <select
            value={filterAsset}
            onChange={(e) => setFilterAsset(e.target.value)}
            className="h-8 px-2 rounded-full bg-muted border border-transparent text-xs text-muted-foreground focus:outline-none focus:border-fin-green/30"
            data-ocid="transactions.asset.select"
          >
            <option value="all">All Assets</option>
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
              title="No transactions found"
              description="Add a transaction to start tracking your portfolio performance."
              icon={ArrowLeftRight}
              action={
                <Button
                  onClick={openAdd}
                  className="bg-fin-green text-background hover:bg-fin-green/90"
                  data-ocid="transactions.empty_state"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Transaction
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground text-xs pl-5">
                    Date
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs">
                    Type
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs">
                    Asset
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">
                    Quantity
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">
                    Price
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">
                    Fee
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">
                    Amount
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs">
                    Note
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right pr-5">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((tx, i) => {
                  const symbol = assetMap.get(tx.assetId.toString()) ?? "—";
                  const amount = tx.quantity * tx.price;
                  const isBuyOrDeposit =
                    tx.txType === TxType.Buy || tx.txType === TxType.Deposit;
                  return (
                    <TableRow
                      key={tx.id.toString()}
                      className="border-border hover:bg-muted/30"
                      data-ocid={`transactions.item.${i + 1}`}
                    >
                      <TableCell className="pl-5 text-xs text-muted-foreground">
                        {formatDate(tx.date)}
                      </TableCell>
                      <TableCell>
                        <TxTypeBadge txType={tx.txType} />
                      </TableCell>
                      <TableCell className="text-sm font-bold font-mono text-foreground">
                        {symbol}
                      </TableCell>
                      <TableCell className="text-right text-sm text-foreground tabular-nums">
                        {tx.quantity.toLocaleString(undefined, {
                          maximumFractionDigits: 6,
                        })}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                        $
                        {tx.price.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 6,
                        })}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                        $
                        {tx.fee.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell
                        className={`text-right text-sm font-medium tabular-nums ${
                          isBuyOrDeposit ? "text-fin-green" : "text-fin-red"
                        }`}
                      >
                        {isBuyOrDeposit ? "+" : "-"}$
                        {amount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                        {tx.note || "—"}
                      </TableCell>
                      <TableCell className="text-right pr-5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-fin-red"
                          onClick={() => setDeleteTarget(tx)}
                          data-ocid={`transactions.delete_button.${i + 1}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
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
          className="bg-card border-border max-w-md"
          data-ocid="transactions.dialog"
        >
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Add Transaction
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-foreground text-sm">Asset *</Label>
                <select
                  value={form.assetId}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, assetId: e.target.value }))
                  }
                  className="mt-1 w-full h-10 px-3 rounded-md bg-muted border border-border text-foreground text-sm"
                  required
                  data-ocid="transactions.asset_select.select"
                >
                  <option value="">Select asset...</option>
                  {assets?.map((a) => (
                    <option key={a.id.toString()} value={a.id.toString()}>
                      {a.symbol} — {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-foreground text-sm">Type *</Label>
                <select
                  value={form.txType}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, txType: e.target.value as TxType }))
                  }
                  className="mt-1 w-full h-10 px-3 rounded-md bg-muted border border-border text-foreground text-sm"
                  data-ocid="transactions.type.select"
                >
                  <option value={TxType.Buy}>Buy</option>
                  <option value={TxType.Sell}>Sell</option>
                  <option value={TxType.Deposit}>Deposit</option>
                  <option value={TxType.Withdraw}>Withdraw</option>
                </select>
              </div>
            </div>
            <div>
              <Label className="text-foreground text-sm">Date *</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm((p) => ({ ...p, date: e.target.value }))
                }
                className="mt-1 bg-muted border-border"
                required
                data-ocid="transactions.date.input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-foreground text-sm">Quantity *</Label>
                <Input
                  type="number"
                  step="any"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, quantity: e.target.value }))
                  }
                  placeholder="0.00"
                  className="mt-1 bg-muted border-border"
                  required
                  data-ocid="transactions.quantity.input"
                />
              </div>
              <div>
                <Label className="text-foreground text-sm">Price *</Label>
                <Input
                  type="number"
                  step="any"
                  value={form.price}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, price: e.target.value }))
                  }
                  placeholder="0.00"
                  className="mt-1 bg-muted border-border"
                  required
                  data-ocid="transactions.price.input"
                />
              </div>
            </div>
            <div>
              <Label className="text-foreground text-sm">Fee</Label>
              <Input
                type="number"
                step="any"
                value={form.fee}
                onChange={(e) =>
                  setForm((p) => ({ ...p, fee: e.target.value }))
                }
                placeholder="0.00"
                className="mt-1 bg-muted border-border"
                data-ocid="transactions.fee.input"
              />
            </div>
            <div>
              <Label className="text-foreground text-sm">Note</Label>
              <Input
                value={form.note}
                onChange={(e) =>
                  setForm((p) => ({ ...p, note: e.target.value }))
                }
                placeholder="Optional note"
                className="mt-1 bg-muted border-border"
                data-ocid="transactions.note.input"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogOpen(false)}
                className="text-muted-foreground"
                data-ocid="transactions.cancel_button"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addTransaction.isPending}
                className="bg-fin-green text-background hover:bg-fin-green/90"
                data-ocid="transactions.submit_button"
              >
                {addTransaction.isPending ? "Adding..." : "Add Transaction"}
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
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Delete Transaction
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this{" "}
              <strong className="text-foreground">
                {deleteTarget?.txType}
              </strong>{" "}
              transaction? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-border"
              data-ocid="transactions.delete.cancel_button"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-ocid="transactions.delete.confirm_button"
            >
              {deleteTransaction.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
