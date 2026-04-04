import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActor } from "@/hooks/useActor";
import { useInternetIdentity } from "@/hooks/useInternetIdentity";
import { useUpdateProfile } from "@/hooks/useQueries";
import { useQueryClient } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

interface Props {
  onComplete: () => void;
}

export default function ProfileSetupModal({ onComplete }: Props) {
  const { identity } = useInternetIdentity();
  const { actor } = useActor();
  const [displayName, setDisplayName] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const updateProfile = useUpdateProfile();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !identity || !actor) return;
    await updateProfile.mutateAsync({
      displayName: displayName.trim(),
      baseCurrency,
      createdAt: BigInt(Date.now()),
      user: identity.getPrincipal(),
    });
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-2xl p-8 w-full max-w-md shadow-card"
        data-ocid="profile_setup.dialog"
      >
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-fin-green/20 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-fin-green" />
          </div>
          <h2 className="text-xl font-bold text-foreground">
            Set up your profile
          </h2>
        </div>
        <p className="text-muted-foreground text-sm mb-6">
          Welcome to FinFolio! Tell us a bit about yourself to get started.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="displayName" className="text-foreground">
              Display Name
            </Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Alex Nguyen"
              className="mt-1 bg-muted border-border"
              required
              data-ocid="profile_setup.input"
            />
          </div>
          <div>
            <Label htmlFor="currency" className="text-foreground">
              Base Currency
            </Label>
            <select
              id="currency"
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value)}
              className="mt-1 w-full h-10 px-3 rounded-md bg-muted border border-border text-foreground text-sm"
              data-ocid="profile_setup.select"
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
            disabled={updateProfile.isPending || !displayName.trim()}
            className="w-full bg-fin-green text-background hover:bg-fin-green/90 font-semibold"
            data-ocid="profile_setup.submit_button"
          >
            {updateProfile.isPending ? "Saving..." : "Get Started"}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
