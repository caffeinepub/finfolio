import { PageLoader } from "@/components/LoadingStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useInternetIdentity } from "@/hooks/useInternetIdentity";
import {
  type PortfolioExport,
  useExportPortfolio,
  useGetProfile,
  useImportPortfolio,
  useUpdateProfile,
} from "@/hooks/useQueries";
import {
  Database,
  Download,
  Loader2,
  TrendingUp,
  Upload,
  User,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export default function SettingsPage() {
  const { t } = useTranslation();
  const { data: profile, isLoading } = useGetProfile();
  const { identity } = useInternetIdentity();
  const updateProfile = useUpdateProfile();
  const exportPortfolio = useExportPortfolio();
  const importPortfolio = useImportPortfolio();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("USD");

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setBaseCurrency(profile.baseCurrency);
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identity) return;
    try {
      await updateProfile.mutateAsync({
        displayName: displayName.trim(),
        baseCurrency,
        createdAt: profile?.createdAt ?? BigInt(Date.now()),
        user: identity.getPrincipal(),
      });
      toast.success(t("settings.profileSaved"));
    } catch {
      toast.error(t("settings.profileFailed"));
    }
  };

  const handleExport = async () => {
    try {
      const data = await exportPortfolio.mutateAsync();
      const json = JSON.stringify(
        data,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2,
      );
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const today = new Date().toISOString().split("T")[0];
      const a = document.createElement("a");
      a.href = url;
      a.download = `miinsolio-portfolio-${today}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("settings.exportSuccess"));
    } catch {
      toast.error(t("settings.importError"));
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const raw = JSON.parse(ev.target?.result as string) as PortfolioExport;
        if (!Array.isArray(raw.assets) || !Array.isArray(raw.transactions)) {
          toast.error(t("settings.importError"));
          return;
        }
        // Revive bigint strings back to bigint
        const reviveBigInts = <T extends object>(obj: T): T =>
          JSON.parse(JSON.stringify(obj), (_, v) => {
            if (typeof v === "string" && /^\d{10,}$/.test(v)) {
              return BigInt(v);
            }
            return v as unknown;
          }) as T;

        const data: PortfolioExport = {
          ...raw,
          assets: raw.assets.map(reviveBigInts),
          transactions: raw.transactions.map(reviveBigInts),
        };

        const result = await importPortfolio.mutateAsync(data);
        toast.success(
          t("settings.importSuccess", {
            assets: result.assets,
            transactions: result.transactions,
          }),
        );
      } catch {
        toast.error(t("settings.importError"));
      } finally {
        // Reset file input so same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  if (isLoading) return <PageLoader />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-2xl mx-auto space-y-4 px-0"
    >
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">
          {t("settings.title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {t("settings.subtitle")}
        </p>
      </div>

      {/* Profile Card */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-fin-blue/20 flex items-center justify-center">
            <User className="w-5 h-5 text-fin-blue" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t("settings.profileTitle")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {identity
                ? `${identity.getPrincipal().toString().slice(0, 24)}...`
                : ""}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="name" className="text-foreground text-sm">
              {t("settings.displayNameLabel")}
            </Label>
            <Input
              id="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t("settings.displayNamePlaceholder")}
              className="mt-1 bg-muted border-border"
              data-ocid="settings.name.input"
            />
          </div>

          <div>
            <Label htmlFor="currency" className="text-foreground text-sm">
              {t("settings.baseCurrencyLabel")}
            </Label>
            <select
              id="currency"
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value)}
              className="mt-1 w-full h-10 px-3 rounded-md bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-fin-green"
              data-ocid="settings.currency.select"
            >
              <option value="USD">USD - US Dollar</option>
              <option value="VND">VND - Vietnamese Dong</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="JPY">JPY - Japanese Yen</option>
            </select>
          </div>

          <Button
            type="submit"
            disabled={updateProfile.isPending}
            className="w-full bg-fin-green text-background hover:bg-fin-green/90 font-semibold"
            data-ocid="settings.submit_button"
          >
            {updateProfile.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t("common.saving")}
              </>
            ) : (
              t("common.save")
            )}
          </Button>
        </form>
      </div>

      {/* Price Data Card */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-card">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-fin-green/15 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-fin-green" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t("settings.priceDataTitle")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("settings.priceDataSubtitle")}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* 3-col first row — responsive grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center justify-center gap-1 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-fin-green animate-pulse inline-block" />
                <span className="text-xs font-semibold text-foreground">
                  {t("badges.Crypto")}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">CoinGecko</p>
              <p className="text-[10px] text-fin-green mt-0.5">
                {t("settings.autoFree")}
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center justify-center gap-1 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-fin-green animate-pulse inline-block" />
                <span className="text-xs font-semibold text-foreground">
                  {t("badges.Forex")}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Frankfurter</p>
              <p className="text-[10px] text-fin-green mt-0.5">
                {t("settings.autoFree")}
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center justify-center gap-1 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-fin-green animate-pulse inline-block" />
                <span className="text-xs font-semibold text-foreground">
                  {t("badges.Stock")}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Yahoo Finance</p>
              <p className="text-[10px] text-fin-green mt-0.5">
                {t("settings.autoFree")}
              </p>
            </div>
          </div>

          {/* 2-col second row: Metals + Oil (both Yahoo Finance) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-center">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center justify-center gap-1 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse inline-block" />
                <span className="text-xs font-semibold text-foreground">
                  {t("badges.Commodity")} — XAU, XAG, XPT, XPD
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Yahoo Finance</p>
              <p className="text-[10px] text-fin-green mt-0.5">
                {t("settings.autoFree")}
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center justify-center gap-1 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse inline-block" />
                <span className="text-xs font-semibold text-foreground">
                  {t("badges.Commodity")} — CL=F, BZ=F
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Yahoo Finance</p>
              <p className="text-[10px] text-fin-green mt-0.5">
                {t("settings.autoFree")}
              </p>
            </div>
          </div>

          <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2.5 leading-relaxed">
            {t("settings.priceDataNote")}
          </div>
        </div>
      </div>

      {/* Data Management Card */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-card">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-fin-green/15 flex items-center justify-center">
            <Database className="w-5 h-5 text-fin-green" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t("settings.dataManagement")}
            </h2>
          </div>
        </div>

        <div className="space-y-3">
          {/* Export */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-muted/30 rounded-lg">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {t("settings.exportPortfolio")}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {t("settings.exportDescription")}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exportPortfolio.isPending}
              className="w-full sm:w-auto shrink-0 border-fin-green/50 text-fin-green hover:bg-fin-green/10 hover:text-fin-green hover:border-fin-green min-h-[44px] sm:min-h-0"
              data-ocid="settings.export.button"
            >
              {exportPortfolio.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span className="ml-1.5">
                {exportPortfolio.isPending
                  ? t("common.loading")
                  : t("settings.exportPortfolio")}
              </span>
            </Button>
          </div>

          {/* Import */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-muted/30 rounded-lg">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {t("settings.importPortfolio")}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {t("settings.importDescription")}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={importPortfolio.isPending}
              className="w-full sm:w-auto shrink-0 border-border text-foreground hover:bg-muted min-h-[44px] sm:min-h-0"
              data-ocid="settings.import.button"
            >
              {importPortfolio.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span className="ml-1.5">
                {importPortfolio.isPending
                  ? t("common.loading")
                  : t("settings.importPortfolio")}
              </span>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportFile}
              data-ocid="settings.import.file_input"
            />
          </div>
        </div>
      </div>

      {/* About Card */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-card">
        <h2 className="text-base font-semibold text-foreground mb-3">
          {t("settings.aboutTitle")}
        </h2>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>{t("settings.version")}</p>
          <p>{t("settings.aboutDesc1")}</p>
          <p>{t("settings.aboutDesc2")}</p>
        </div>
      </div>
    </motion.div>
  );
}
