import type { Public__1 } from "@/backend.d";
import { Category } from "@/backend.d";
import {
  AssetSearchInput,
  METAL_SYMBOLS,
  OIL_SYMBOLS,
} from "@/components/AssetSearchInput";
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
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

const EMPTY_ASSET: Omit<Public__1, "id" | "createdAt"> = {
  name: "",
  symbol: "",
  category: Category.Stock,
  currency: "USD",
  manualPrice: 0,
  note: "",
};

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

function formatCurrencyVal(value: number, currency: string): string {
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

function displaySymbol(symbol: string): string {
  if (symbol.endsWith(".VN")) return symbol.replace(".VN", "");
  if (symbol.includes(":")) return symbol.split(":").pop()!.toUpperCase();
  return symbol;
}

/** Determine which banner to show for a commodity symbol */
function getCommodityBannerKey(symbol: string): "metal" | "oil" | "unknown" {
  const sym = symbol.toUpperCase();
  if (METAL_SYMBOLS.has(sym)) return "metal";
  if (OIL_SYMBOLS.has(sym)) return "oil";
  return "unknown";
}

export default function AssetsPage() {
  const { t } = useTranslation();
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
      toast.error(t("assets.selectAsset"));
      return;
    }
    try {
      if (editTarget) {
        await updateAsset.mutateAsync({ ...editTarget, ...form });
        toast.success(t("assets.assetUpdated"));
      } else {
        await addAsset.mutateAsync({
          id: 0n,
          createdAt: BigInt(Date.now()),
          ...form,
        });
        toast.success(t("assets.assetAdded"));
      }
      setDialogOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`${t("assets.failedToSave")} ${msg}`);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAsset.mutateAsync(deleteTarget.id);
      toast.success(t("assets.assetDeleted"));
      setDeleteTarget(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`${t("assets.failedToDelete")} ${msg}`);
    }
  };

  const isCash = form.category === Category.Cash;
  const isCommodity = form.category === Category.Commodity;
  const isRealEstate = form.category === Category.RealEstate;
  const isPending = addAsset.isPending || updateAsset.isPending;

  // Derive if price field should show
  const showPriceField = isCash || isRealEstate;
  const liveSource =
    !showPriceField && !isCommodity
      ? form.category === Category.Crypto
        ? "CoinGecko"
        : form.category === Category.Forex
          ? "Frankfurter"
          : "Yahoo Finance"
      : "";

  // Commodity banner variant based on currently selected symbol
  const commodityBannerType = isCommodity
    ? getCommodityBannerKey(form.symbol)
    : null;

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
            {t("assets.title")}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {t("assets.subtitle")}
          </p>
        </div>
        <Button
          onClick={openAdd}
          className="bg-fin-green text-background hover:bg-fin-green/90 gap-2 min-h-[44px] shrink-0"
          data-ocid="assets.add_button"
        >
          <Plus className="w-4 h-4" /> {t("assets.addAsset")}
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
              title={t("assets.noAssetsYet")}
              description={t("assets.noAssetsDesc")}
              icon={Coins}
              action={
                <Button
                  onClick={openAdd}
                  className="bg-fin-green text-background hover:bg-fin-green/90"
                  data-ocid="assets.empty_state"
                >
                  <Plus className="w-4 h-4 mr-1" /> {t("assets.addAsset")}
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
                    {t("assets.symbolCol")}
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs hidden sm:table-cell">
                    {t("assets.nameCol")}
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs">
                    {t("assets.categoryCol")}
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs hidden sm:table-cell">
                    {t("assets.currencyCol")}
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">
                    {t("assets.livePriceCol")}
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right pr-4 sm:pr-5">
                    {t("assets.actionsCol")}
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
                    <TableCell className="pl-4 sm:pl-5">
                      <span className="text-xs sm:text-sm font-bold font-mono text-foreground">
                        {displaySymbol(asset.symbol)}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm text-foreground hidden sm:table-cell">
                      {asset.name}
                    </TableCell>
                    <TableCell>
                      <CategoryBadge category={asset.category} />
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm text-muted-foreground hidden sm:table-cell">
                      {asset.currency}
                    </TableCell>
                    <TableCell className="text-right">
                      {asset.category === Category.Cash ||
                      asset.category === Category.RealEstate ? (
                        <span className="text-xs sm:text-sm font-mono text-foreground whitespace-nowrap">
                          {formatCurrencyVal(asset.manualPrice, asset.currency)}
                        </span>
                      ) : (
                        <LivePriceBadge
                          symbol={asset.symbol}
                          currency={getLivePriceCurrency(
                            asset.category,
                            asset.currency,
                            asset.symbol,
                          )}
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-4 sm:pr-5">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 sm:h-7 sm:w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => openEdit(asset)}
                          data-ocid={`assets.edit_button.${i + 1}`}
                          aria-label={t("assets.editAsset")}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 sm:h-7 sm:w-7 text-muted-foreground hover:text-fin-red"
                          onClick={() => setDeleteTarget(asset)}
                          data-ocid={`assets.delete_button.${i + 1}`}
                          aria-label={t("common.delete")}
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
          className="bg-card border-border w-full max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto"
          data-ocid="assets.dialog"
        >
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editTarget ? t("assets.editAsset") : t("assets.addAsset")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-foreground text-sm">
                  {t("assets.categoryLabel")} *
                </Label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm((p) => {
                      const newCat = e.target.value as Category;
                      return {
                        ...p,
                        category: newCat,
                        symbol: "",
                        name: "",
                        currency: "USD",
                        manualPrice: 0,
                      };
                    })
                  }
                  className="mt-1 w-full h-10 px-3 rounded-md bg-muted border border-border text-foreground text-sm"
                  data-ocid="assets.category.select"
                >
                  <option value={Category.Stock}>{t("badges.Stock")}</option>
                  <option value={Category.Crypto}>{t("badges.Crypto")}</option>
                  <option value={Category.Forex}>{t("badges.Forex")}</option>
                  <option value={Category.Cash}>{t("badges.Cash")}</option>
                  <option value={Category.Commodity}>
                    {t("badges.Commodity")}
                  </option>
                  <option value={Category.RealEstate}>
                    {t("badges.RealEstate")}
                  </option>
                </select>
              </div>
              <div>
                <Label className="text-foreground text-sm">
                  {t("assets.currencyLabel")} *
                </Label>
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

            {isCash ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-foreground text-sm">
                    {t("common.symbol")} *
                  </Label>
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
                  <Label className="text-foreground text-sm">
                    {t("common.name")} *
                  </Label>
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
            ) : isCommodity ? (
              /* Commodity: searchable dropdown from static list */
              <div>
                <Label className="text-foreground text-sm">
                  {t("assets.commoditySelectLabel")} *
                </Label>
                <div className="mt-1">
                  <AssetSearchInput
                    category={Category.Commodity}
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
            ) : isRealEstate ? (
              /* Real Estate: plain text input, no API */
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-foreground text-sm">
                    {t("common.symbol")} *
                  </Label>
                  <Input
                    value={form.symbol}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        symbol: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="RE001"
                    className="mt-1 bg-muted border-border uppercase"
                    required
                    data-ocid="assets.symbol.input"
                  />
                </div>
                <div>
                  <Label className="text-foreground text-sm">
                    {t("common.name")} *
                  </Label>
                  <Input
                    value={form.name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder={t("assets.searchPlaceholderRealEstate")}
                    className="mt-1 bg-muted border-border"
                    required
                    data-ocid="assets.name.input"
                  />
                </div>
              </div>
            ) : (
              <div>
                <Label className="text-foreground text-sm">
                  {t("assets.assetLabel")} *
                </Label>
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

            {showPriceField && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Label className="text-foreground text-sm">
                  {isCash ? t("assets.cashValueLabel") : t("common.price")}
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
                  placeholder="0.00"
                  className="mt-1 bg-muted border-border"
                  data-ocid="assets.price.input"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  {isCash
                    ? t("assets.cashValueHelper")
                    : t("assets.realEstateBanner")}
                </p>
              </motion.div>
            )}

            {/* Commodity banner: metal vs oil */}
            {isCommodity && commodityBannerType === "metal" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="flex items-start gap-2 rounded-lg bg-yellow-400/10 border border-yellow-400/20 px-3 py-2.5"
              >
                <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 mt-0.5 shrink-0 animate-pulse" />
                <p className="text-[12px] text-yellow-400 leading-snug">
                  {t("assets.commodityBanner")}
                </p>
              </motion.div>
            )}

            {isCommodity && commodityBannerType === "oil" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="flex items-start gap-2 rounded-lg bg-orange-400/10 border border-orange-400/20 px-3 py-2.5"
              >
                <span className="inline-block w-2 h-2 rounded-full bg-orange-400 mt-0.5 shrink-0 animate-pulse" />
                <p className="text-[12px] text-orange-400 leading-snug">
                  {t("assets.commodityOilBanner")}
                </p>
              </motion.div>
            )}

            {isCommodity &&
              commodityBannerType === "unknown" &&
              form.symbol && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-start gap-2 rounded-lg bg-yellow-400/10 border border-yellow-400/20 px-3 py-2.5"
                >
                  <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 mt-0.5 shrink-0 animate-pulse" />
                  <p className="text-[12px] text-yellow-400 leading-snug">
                    {t("assets.commodityBanner")}
                  </p>
                </motion.div>
              )}

            {isRealEstate && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="flex items-start gap-2 rounded-lg bg-teal-400/10 border border-teal-400/20 px-3 py-2.5"
              >
                <span className="inline-block w-2 h-2 rounded-full bg-teal-400 mt-0.5 shrink-0" />
                <p className="text-[12px] text-teal-400 leading-snug">
                  {t("assets.realEstateBanner")}
                </p>
              </motion.div>
            )}

            {!showPriceField && !isCommodity && !isRealEstate && liveSource && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="flex items-start gap-2 rounded-lg bg-fin-green/10 border border-fin-green/20 px-3 py-2.5"
              >
                <span className="inline-block w-2 h-2 rounded-full bg-fin-green mt-0.5 shrink-0 animate-pulse" />
                <p className="text-[12px] text-fin-green leading-snug">
                  {t("assets.liveSourcePrefix")} {liveSource}.{" "}
                  {t("assets.noManualEntry")}
                </p>
              </motion.div>
            )}

            <div>
              <Label className="text-foreground text-sm">
                {t("assets.noteLabel")}
              </Label>
              <Input
                value={form.note}
                onChange={(e) =>
                  setForm((p) => ({ ...p, note: e.target.value }))
                }
                placeholder={t("common.optional")}
                className="mt-1 bg-muted border-border"
                data-ocid="assets.note.input"
              />
            </div>
            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogOpen(false)}
                className="text-muted-foreground w-full sm:w-auto"
                data-ocid="assets.cancel_button"
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-fin-green text-background hover:bg-fin-green/90 w-full sm:w-auto"
                data-ocid="assets.submit_button"
              >
                {isPending
                  ? t("assets.saving")
                  : editTarget
                    ? t("assets.update")
                    : t("assets.addAsset")}
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
              {t("assets.deleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("assets.deleteDesc")}{" "}
              <strong className="text-foreground">
                {deleteTarget?.symbol}
              </strong>
              {t("assets.deleteDescSuffix")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-border"
              data-ocid="assets.delete.cancel_button"
            >
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-ocid="assets.delete.confirm_button"
            >
              {deleteAsset.isPending
                ? t("common.deleting")
                : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
