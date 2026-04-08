import type { Public__1 } from "@/backend.d";
import { Category } from "@/backend.d";
import { AssetSearchInput } from "@/components/AssetSearchInput";
import { CategoryBadge } from "@/components/Badges";
import { LivePriceBadge } from "@/components/LivePriceBadge";
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
  useAddAsset,
  useDeleteAsset,
  useGetAssets,
  useUpdateAsset,
} from "@/hooks/useQueries";
import { Coins, Pencil, Plus, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";

const EMPTY_ASSET: Omit<Public__1, "id" | "createdAt"> = {
  name: "",
  symbol: "",
  category: Category.Stock,
  currency: "USD",
  manualPrice: 0,
  note: "",
};

/**
 * Determine if manual price input should be shown.
 * All stocks now use Yahoo Finance via backend -- no API key required.
 */
function getPriceFieldConfig(
  category: Category,
  _symbol: string,
): {
  show: boolean;
  label: string;
  helper: string;
  placeholder: string;
  liveSource: string;
} {
  switch (category) {
    case Category.Crypto:
    case Category.Forex:
      return {
        show: false,
        label: "",
        helper: "",
        placeholder: "",
        liveSource: category === Category.Crypto ? "CoinGecko" : "Frankfurter",
      };
    case Category.Stock:
      // All stocks (VN and international) use Yahoo Finance via backend proxy
      return {
        show: false,
        label: "",
        helper: "",
        placeholder: "",
        liveSource: "Yahoo Finance",
      };
    case Category.Cash:
      return {
        show: true,
        label: "Value",
        helper: "No live price available for cash. Enter the current value.",
        placeholder: "0.00",
        liveSource: "",
      };
    default:
      return {
        show: true,
        label: "Manual Price",
        helper: "Used when live price is unavailable.",
        placeholder: "0.00",
        liveSource: "",
      };
  }
}

function formatCurrency(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export default function AssetsPage() {
  const { data: assets, isLoading } = useGetAssets();
  const addAsset = useAddAsset();
  const updateAsset = useUpdateAsset();
  const deleteAsset = useDeleteAsset();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Public__1 | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Public__1 | null>(null);
  const [form, setForm] =
    useState<Omit<Public__1, "id" | "createdAt">>(EMPTY_ASSET);

  const openAdd = () => {
    setEditTarget(null);
    setForm(EMPTY_ASSET);
    setDialogOpen(true);
  };

  const openEdit = (asset: Public__1) => {
    setEditTarget(asset);
    setForm({
      name: asset.name,
      symbol: asset.symbol,
      category: asset.category,
      currency: asset.currency,
      manualPrice: asset.manualPrice,
      note: asset.note,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.symbol.trim()) {
      toast.error("Please select an asset first");
      return;
    }
    try {
      if (editTarget) {
        await updateAsset.mutateAsync({
          ...editTarget,
          ...form,
        });
        toast.success("Asset updated");
      } else {
        await addAsset.mutateAsync({
          id: 0n,
          createdAt: BigInt(Date.now()),
          ...form,
        });
        toast.success("Asset added");
      }
      setDialogOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to save asset: ${msg}`);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAsset.mutateAsync(deleteTarget.id);
      toast.success("Asset deleted");
      setDeleteTarget(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to delete asset: ${msg}`);
    }
  };

  const isCash = form.category === Category.Cash;
  const isPending = addAsset.isPending || updateAsset.isPending;

  // Reactive: derive price field config from current form category + symbol
  const priceFieldConfig = getPriceFieldConfig(form.category, form.symbol);

  // Display symbol nicely (strip .VN suffix for UI)
  function displaySymbol(symbol: string): string {
    if (symbol.endsWith(".VN")) return symbol.replace(".VN", "");
    if (symbol.includes(":")) return symbol.split(":").pop()!.toUpperCase();
    return symbol;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Assets</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage your tracked assets
          </p>
        </div>
        <Button
          onClick={openAdd}
          className="bg-fin-green text-background hover:bg-fin-green/90 gap-2"
          data-ocid="assets.add_button"
        >
          <Plus className="w-4 h-4" /> Add Asset
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <PageLoader />
          </div>
        ) : !assets || assets.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No assets yet"
              description="Add your first asset to start tracking investments."
              icon={Coins}
              action={
                <Button
                  onClick={openAdd}
                  className="bg-fin-green text-background hover:bg-fin-green/90"
                  data-ocid="assets.empty_state"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Asset
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
                    Symbol
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs">
                    Name
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs">
                    Category
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs">
                    Currency
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">
                    Live Price
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right pr-5">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((asset, i) => (
                  <TableRow
                    key={asset.id.toString()}
                    className="border-border hover:bg-muted/30"
                    data-ocid={`assets.item.${i + 1}`}
                  >
                    <TableCell className="pl-5">
                      <span className="text-sm font-bold font-mono text-foreground">
                        {displaySymbol(asset.symbol)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {asset.name}
                    </TableCell>
                    <TableCell>
                      <CategoryBadge category={asset.category} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {asset.currency}
                    </TableCell>
                    <TableCell className="text-right">
                      {asset.category === Category.Cash ? (
                        <span className="text-sm font-mono text-foreground">
                          {formatCurrency(asset.manualPrice, asset.currency)}
                        </span>
                      ) : (
                        <LivePriceBadge
                          symbol={asset.symbol}
                          currency={asset.currency}
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-5">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => openEdit(asset)}
                          data-ocid={`assets.edit_button.${i + 1}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-fin-red"
                          onClick={() => setDeleteTarget(asset)}
                          data-ocid={`assets.delete_button.${i + 1}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="bg-card border-border max-w-md"
          data-ocid="assets.dialog"
        >
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editTarget ? "Edit Asset" : "Add Asset"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Category + Currency row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-foreground text-sm">Category *</Label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      category: e.target.value as Category,
                      // Reset symbol/name when switching categories
                      symbol: "",
                      name: "",
                      manualPrice: 0,
                    }))
                  }
                  className="mt-1 w-full h-10 px-3 rounded-md bg-muted border border-border text-foreground text-sm"
                  data-ocid="assets.category.select"
                >
                  <option value={Category.Stock}>Stock</option>
                  <option value={Category.Crypto}>Crypto</option>
                  <option value={Category.Forex}>Forex</option>
                  <option value={Category.Cash}>Cash</option>
                </select>
              </div>
              <div>
                <Label className="text-foreground text-sm">Currency *</Label>
                <select
                  value={form.currency}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, currency: e.target.value }))
                  }
                  className="mt-1 w-full h-10 px-3 rounded-md bg-muted border border-border text-foreground text-sm"
                  data-ocid="assets.currency.select"
                >
                  <option value="USD">USD</option>
                  <option value="VND">VND</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="JPY">JPY</option>
                  <option value="BTC">BTC</option>
                  <option value="ETH">ETH</option>
                </select>
              </div>
            </div>

            {/* Symbol + Name: search autocomplete for non-Cash, plain text for Cash */}
            {isCash ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-foreground text-sm">Symbol *</Label>
                  <Input
                    value={form.symbol}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        symbol: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="USD"
                    className="mt-1 bg-muted border-border uppercase"
                    required
                    data-ocid="assets.symbol.input"
                  />
                </div>
                <div>
                  <Label className="text-foreground text-sm">Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="US Dollars"
                    className="mt-1 bg-muted border-border"
                    required
                    data-ocid="assets.name.input"
                  />
                </div>
              </div>
            ) : (
              <div>
                <Label className="text-foreground text-sm">Asset *</Label>
                <div className="mt-1">
                  <AssetSearchInput
                    category={form.category}
                    onSelect={(result) =>
                      setForm((p) => ({
                        ...p,
                        symbol: result.symbol,
                        name: result.name,
                      }))
                    }
                    selectedSymbol={form.symbol || undefined}
                    selectedName={form.name || undefined}
                    onClear={() =>
                      setForm((p) => ({ ...p, symbol: "", name: "" }))
                    }
                  />
                </div>
              </div>
            )}

            {/* Conditional Manual Price field */}
            {priceFieldConfig.show && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Label className="text-foreground text-sm">
                  {priceFieldConfig.label}
                </Label>
                <Input
                  type="number"
                  step="any"
                  value={form.manualPrice}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      manualPrice: Number.parseFloat(e.target.value) || 0,
                    }))
                  }
                  placeholder={priceFieldConfig.placeholder}
                  className="mt-1 bg-muted border-border"
                  data-ocid="assets.price.input"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  {priceFieldConfig.helper}
                </p>
              </motion.div>
            )}

            {/* Info banner when price field is hidden (has live source) */}
            {!priceFieldConfig.show && priceFieldConfig.liveSource && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="flex items-start gap-2 rounded-lg bg-fin-green/10 border border-fin-green/20 px-3 py-2.5"
              >
                <span className="inline-block w-2 h-2 rounded-full bg-fin-green mt-0.5 shrink-0 animate-pulse" />
                <p className="text-[12px] text-fin-green leading-snug">
                  Live price provided automatically via{" "}
                  {priceFieldConfig.liveSource}. No manual entry needed.
                </p>
              </motion.div>
            )}

            <div>
              <Label className="text-foreground text-sm">Note</Label>
              <Input
                value={form.note}
                onChange={(e) =>
                  setForm((p) => ({ ...p, note: e.target.value }))
                }
                placeholder="Optional note"
                className="mt-1 bg-muted border-border"
                data-ocid="assets.note.input"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogOpen(false)}
                className="text-muted-foreground"
                data-ocid="assets.cancel_button"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-fin-green text-background hover:bg-fin-green/90"
                data-ocid="assets.submit_button"
              >
                {isPending ? "Saving..." : editTarget ? "Update" : "Add Asset"}
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
              Delete Asset
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong className="text-foreground">
                {deleteTarget?.symbol}
              </strong>
              ? This will also remove all associated holdings data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-border"
              data-ocid="assets.delete.cancel_button"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-ocid="assets.delete.confirm_button"
            >
              {deleteAsset.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
