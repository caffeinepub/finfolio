import { Button } from "@/components/ui/button";
import { useInternetIdentity } from "@/hooks/useInternetIdentity";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, Lock, Shield, TrendingUp } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

export default function LoginPage() {
  const { login, loginStatus, clear } = useInternetIdentity();
  const qc = useQueryClient();
  const [error, setError] = useState("");

  const isLoggingIn = loginStatus === "logging-in";

  const handleLogin = async () => {
    setError("");
    try {
      await login();
    } catch (e: any) {
      if (e.message === "User is already authenticated") {
        await clear();
        qc.clear();
        setTimeout(() => login(), 300);
      } else {
        setError("Login failed. Please try again.");
      }
    }
  };

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
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-fin-green/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-fin-green" />
            </div>
            <span className="font-display text-2xl font-bold text-foreground">
              FinFolio
            </span>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Welcome back
          </h1>
          <p className="text-muted-foreground">
            Sign in to manage your investment portfolio
          </p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-card">
          <div className="space-y-4 mb-6">
            {[
              {
                icon: BarChart3,
                title: "Portfolio Tracking",
                desc: "Stocks, Crypto, Forex & Cash",
              },
              {
                icon: TrendingUp,
                title: "Performance Analytics",
                desc: "Real-time P&L and allocation",
              },
              {
                icon: Shield,
                title: "Secure & Private",
                desc: "Your data on the Internet Computer",
              },
            ].map((item) => (
              <div key={item.title} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-fin-green/10 flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-4 h-4 text-fin-green" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
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
            {isLoggingIn ? "Signing in..." : "Sign in with Internet Identity"}
          </Button>

          <p className="text-center text-xs text-muted-foreground mt-4">
            Powered by Internet Identity — no passwords needed
          </p>
        </div>
      </motion.div>
    </div>
  );
}
