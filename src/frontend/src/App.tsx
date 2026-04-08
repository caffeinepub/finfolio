import type { Public } from "@/backend.d";
import Sidebar, { type Page } from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { Toaster } from "@/components/ui/sonner";
import { PortfolioVisibilityProvider } from "@/contexts/PortfolioVisibilityContext";
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
        return null;
      }
    },
    enabled: !!actor && !actorFetching,
    retry: false,
  });

  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && !actorFetching && query.isFetched,
  };
}

function AuthenticatedApp() {
  const [activePage, setActivePage] = useState<Page>("overview");
  const [dateRange, setDateRange] = useState("Last 30 Days");
  const [profileSetupDone, setProfileSetupDone] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
    queryClient.invalidateQueries({ queryKey: ["currentUserProfile"] });
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  };

  const handleNavigate = (page: Page) => {
    setActivePage(page);
    setSidebarOpen(false);
  };

  return (
    <PortfolioVisibilityProvider>
      <PriceFeedProvider>
        <div className="min-h-screen bg-background flex min-w-0 overflow-x-hidden w-full">
          {/* Mobile overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
              onKeyDown={(e) => e.key === "Escape" && setSidebarOpen(false)}
              aria-hidden="true"
            />
          )}

          <Sidebar
            activePage={activePage}
            onNavigate={handleNavigate}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />

          {/* Main content: full width on mobile/tablet, offset on desktop */}
          <main className="flex-1 min-h-screen lg:ml-60 ml-0 min-w-0 max-w-full overflow-x-hidden">
            <div className="p-4 sm:p-6 w-full min-w-0 max-w-screen-xl mx-auto overflow-x-hidden">
              {/* Shared TopBar — shown on all pages */}
              <TopBar
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                onToggleSidebar={() => setSidebarOpen((v) => !v)}
              />

              {activePage === "overview" && (
                <OverviewPage dateRange={dateRange} />
              )}
              {activePage === "portfolio" && <PortfolioPage />}
              {activePage === "assets" && <AssetsPage />}
              {activePage === "transactions" && <TransactionsPage />}
              {activePage === "settings" && <SettingsPage />}
            </div>

            {/* Footer */}
            <footer className="px-4 sm:px-6 py-4 border-t border-border text-center">
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
    </PortfolioVisibilityProvider>
  );
}

export default function App() {
  const { identity, isInitializing } = useInternetIdentity();
  const { isFetching: actorFetching } = useActor();
  const isAuthenticated = !!identity;

  if (isInitializing || (isAuthenticated && actorFetching)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-fin-green animate-spin" />
          <p className="text-muted-foreground text-sm">Loading Miinsolio...</p>
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
