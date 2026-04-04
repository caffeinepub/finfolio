import { PageLoader } from "@/components/LoadingStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePrices } from "@/contexts/PriceFeedContext";
import { useInternetIdentity } from "@/hooks/useInternetIdentity";
import { useGetProfile, useUpdateProfile } from "@/hooks/useQueries";
import {
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  TrendingUp,
  User,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function SettingsPage() {
  const { data: profile, isLoading } = useGetProfile();
  const { identity } = useInternetIdentity();
  const updateProfile = useUpdateProfile();
  const { refetch } = usePrices();

  const [displayName, setDisplayName] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("USD");

  // Finnhub key state
  const [finnhubKey, setFinnhubKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setBaseCurrency(profile.baseCurrency);
    }
  }, [profile]);

  useEffect(() => {
    const stored = localStorage.getItem("finnhub_key") ?? "";
    setFinnhubKey(stored);
  }, []);

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

  const handleTestKey = async () => {
    const key = finnhubKey.trim();
    if (!key) {
      toast.error("Please enter an API key first");
      return;
    }
    setTestingKey(true);
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=AAPL&token=${encodeURIComponent(key)}`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (!res.ok) {
        toast.error("Invalid key or API error");
        return;
      }
      const json = await res.json();
      if (typeof json?.c === "number" && json.c > 0) {
        toast.success(`Key works! AAPL = $${json.c.toFixed(2)}`);
      } else {
        toast.error("Key returned no data — it may be invalid");
      }
    } catch {
      toast.error("Test failed — check your internet connection");
    } finally {
      setTestingKey(false);
    }
  };

  const handleSaveKey = async () => {
    setSavingKey(true);
    try {
      localStorage.setItem("finnhub_key", finnhubKey.trim());
      window.dispatchEvent(new Event("finnhub-key-updated"));
      toast.success("Finnhub API key saved");
      refetch();
    } finally {
      setSavingKey(false);
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
              <p className="text-[11px] text-muted-foreground">CoinCap API</p>
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
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />
                <span className="text-xs font-semibold text-foreground">
                  Stocks
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Finnhub.io</p>
              <p className="text-[10px] text-yellow-400 mt-0.5">Key required</p>
            </div>
          </div>

          <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2.5 leading-relaxed">
            Crypto and Forex rates are fetched automatically every 30 seconds.
            US stock prices (NYSE, NASDAQ) require a free Finnhub API key.
          </div>

          {/* Finnhub Key Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-foreground text-sm">Finnhub API Key</Label>
              <a
                href="https://finnhub.io/register"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-fin-green/80 hover:text-fin-green flex items-center gap-1 transition-colors"
                data-ocid="settings.finnhub.link"
              >
                Get free key <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={finnhubKey}
                onChange={(e) => setFinnhubKey(e.target.value)}
                placeholder="Enter your Finnhub API key"
                className="bg-muted border-border pr-10"
                data-ocid="settings.finnhub.input"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                data-ocid="settings.finnhub.toggle"
              >
                {showKey ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleTestKey}
              disabled={testingKey || !finnhubKey.trim()}
              className="flex-1 border-border text-foreground hover:bg-muted"
              data-ocid="settings.finnhub.test_button"
            >
              {testingKey ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                "Test Key"
              )}
            </Button>
            <Button
              type="button"
              onClick={handleSaveKey}
              disabled={savingKey}
              className="flex-1 bg-fin-green text-background hover:bg-fin-green/90 font-semibold"
              data-ocid="settings.finnhub.save_button"
            >
              {savingKey ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Key"
              )}
            </Button>
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
