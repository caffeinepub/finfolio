import type { Public } from "@/backend.d";
import Sidebar, { type Page } from "@/components/Sidebar";
import { Toaster } from "@/components/ui/sonner";
import { PriceFeedProvider } from "@/contexts/PriceFeedContext";
import { useActor } from "@/hooks/useActor";
import { useInternetIdentity } from "@/hooks/useInternetIdentity";
import AssetsPage from "@/pages/AssetsPage";
import LoginPage from "@/pages/LoginPage";
import OverviewPage from "@/pages/OverviewPage";
import PortfolioPage from "@/pages/PortfolioPage";
import ProfileSetupModal from "@/pages/ProfileSetupModal";
import SettingsPage from "@/pages/SettingsPage";
import TransactionsPage from "@/pages/TransactionsPage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";

function useGetCallerUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();

  const query = useQuery<Public | null>({
    queryKey: ["currentUserProfile"],
    queryFn: async () => {
      if (!actor) return null;
      try {
        return await actor.getCallerUserProfile();
      } catch {
        // Backend may throw when user is not yet registered (race with access control init)
        return null;
      }
    },
    enabled: !!actor && !actorFetching,
    retry: false,
  });

  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && query.isFetched,
  };
}

function AuthenticatedApp() {
  const [activePage, setActivePage] = useState<Page>("overview");
  const [dateRange, setDateRange] = useState("Last 30 Days");
  const [profileSetupDone, setProfileSetupDone] = useState(false);
  const queryClient = useQueryClient();

  const {
    data: userProfile,
    isLoading: profileLoading,
    isFetched: profileFetched,
  } = useGetCallerUserProfile();

  const showProfileSetup =
    !profileLoading &&
    profileFetched &&
    userProfile === null &&
    !profileSetupDone;

  const handleProfileComplete = () => {
    setProfileSetupDone(true);
    // Invalidate profile queries so the app refreshes with the new profile
    queryClient.invalidateQueries({ queryKey: ["currentUserProfile"] });
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  };

  return (
    <PriceFeedProvider>
      <div className="min-h-screen bg-background flex">
        <Sidebar activePage={activePage} onNavigate={setActivePage} />

        <main className="flex-1 ml-60 min-h-screen">
          <div className="p-6 max-w-screen-xl mx-auto">
            {activePage === "overview" && (
              <OverviewPage
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
              />
            )}
            {activePage === "portfolio" && <PortfolioPage />}
            {activePage === "assets" && <AssetsPage />}
            {activePage === "transactions" && <TransactionsPage />}
            {activePage === "settings" && <SettingsPage />}
          </div>

          {/* Footer */}
          <footer className="px-6 py-4 border-t border-border text-center">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} Built with{" "}
              <span className="text-fin-green">♥</span> using{" "}
              <a
                href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-fin-green/80 hover:text-fin-green transition-colors"
              >
                caffeine.ai
              </a>
            </p>
          </footer>
        </main>

        {showProfileSetup && (
          <ProfileSetupModal onComplete={handleProfileComplete} />
        )}
      </div>
    </PriceFeedProvider>
  );
}

export default function App() {
  const { identity, isInitializing } = useInternetIdentity();
  const isAuthenticated = !!identity;

  // Show full-page loader while initializing
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-fin-green animate-spin" />
          <p className="text-muted-foreground text-sm">Loading FinFolio...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginPage />
        <Toaster richColors theme="dark" />
      </>
    );
  }

  return (
    <>
      <AuthenticatedApp />
      <Toaster richColors theme="dark" />
    </>
  );
}
