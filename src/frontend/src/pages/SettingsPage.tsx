import { PageLoader } from "@/components/LoadingStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useInternetIdentity } from "@/hooks/useInternetIdentity";
import { useGetProfile, useUpdateProfile } from "@/hooks/useQueries";
import { Loader2, TrendingUp, User } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function SettingsPage() {
  const { data: profile, isLoading } = useGetProfile();
  const { identity } = useInternetIdentity();
  const updateProfile = useUpdateProfile();

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
      toast.success("Profile saved successfully");
    } catch {
      toast.error("Failed to save profile");
    }
  };

  if (isLoading) return <PageLoader />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-lg space-y-4"
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Manage your profile and preferences
        </p>
      </div>

      {/* Profile Card */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-fin-blue/20 flex items-center justify-center">
            <User className="w-5 h-5 text-fin-blue" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Profile</h2>
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
              Display Name
            </Label>
            <Input
              id="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="mt-1 bg-muted border-border"
              data-ocid="settings.name.input"
            />
          </div>

          <div>
            <Label htmlFor="currency" className="text-foreground text-sm">
              Base Currency
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
                Saving...
              </>
            ) : (
              "Save Changes"
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
              Price Data
            </h2>
            <p className="text-xs text-muted-foreground">
              Live market price feeds
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center justify-center gap-1 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-fin-green animate-pulse inline-block" />
                <span className="text-xs font-semibold text-foreground">
                  Crypto
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">CoinGecko</p>
              <p className="text-[10px] text-fin-green mt-0.5">Auto • Free</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center justify-center gap-1 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-fin-green animate-pulse inline-block" />
                <span className="text-xs font-semibold text-foreground">
                  Forex
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Frankfurter</p>
              <p className="text-[10px] text-fin-green mt-0.5">Auto • Free</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center justify-center gap-1 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-fin-green animate-pulse inline-block" />
                <span className="text-xs font-semibold text-foreground">
                  Stocks
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Yahoo Finance</p>
              <p className="text-[10px] text-fin-green mt-0.5">Auto • Free</p>
            </div>
          </div>

          <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2.5 leading-relaxed">
            All prices are fetched automatically every 30 seconds. Stocks use
            Yahoo Finance — no API key required.
          </div>
        </div>
      </div>

      {/* About Card */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-card">
        <h2 className="text-base font-semibold text-foreground mb-3">
          About FinFolio
        </h2>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Version 1.0.0</p>
          <p>Decentralized portfolio management on the Internet Computer.</p>
          <p>Track stocks, crypto, forex, and cash in one place.</p>
        </div>
      </div>
    </motion.div>
  );
}
