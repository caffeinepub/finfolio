import { Button } from "@/components/ui/button";
import { useInternetIdentity } from "@/hooks/useInternetIdentity";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, Lock, Shield, TrendingUp } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export default function LoginPage() {
  const { login, loginStatus, clear } = useInternetIdentity();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const [error, setError] = useState("");

  const isLoggingIn = loginStatus === "logging-in";

  const handleLogin = async () => {
    setError("");
    try {
      await login();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "User is already authenticated") {
        await clear();
        qc.clear();
        setTimeout(() => login(), 300);
      } else {
        setError(t("login.loginFailed"));
      }
    }
  };

  const features = [
    {
      icon: BarChart3,
      titleKey: "login.feature1Title" as const,
      descKey: "login.feature1Desc" as const,
    },
    {
      icon: TrendingUp,
      titleKey: "login.feature2Title" as const,
      descKey: "login.feature2Desc" as const,
    },
    {
      icon: Shield,
      titleKey: "login.feature3Title" as const,
      descKey: "login.feature3Desc" as const,
    },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-10"
          style={{
            background:
              "radial-gradient(circle, oklch(0.72 0.2 155) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-10"
          style={{
            background:
              "radial-gradient(circle, oklch(0.6 0.2 250) 0%, transparent 70%)",
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,oklch(0.24_0.04_240/0.1)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.24_0.04_240/0.1)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-sm px-4 sm:px-0 sm:max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3 sm:mb-4">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-fin-green/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-fin-green" />
            </div>
            <span className="font-display text-xl sm:text-2xl font-bold text-foreground">
              Miinsolio
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            {t("login.title")}
          </h1>
          <p className="text-muted-foreground">{t("login.subtitle")}</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-card">
          <div className="space-y-4 mb-6">
            {features.map((item) => (
              <div key={item.titleKey} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-fin-green/10 flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-4 h-4 text-fin-green" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t(item.titleKey)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(item.descKey)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          <Button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full bg-fin-green text-background hover:bg-fin-green/90 font-semibold h-11"
            data-ocid="login.primary_button"
          >
            <Lock className="w-4 h-4 mr-2" />
            {isLoggingIn ? t("login.signingIn") : t("login.signIn")}
          </Button>

          <p className="text-center text-xs text-muted-foreground mt-4">
            {t("login.poweredBy")}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
