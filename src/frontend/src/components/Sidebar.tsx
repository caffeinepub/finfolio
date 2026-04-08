import { useInternetIdentity } from "@/hooks/useInternetIdentity";
import { useGetProfile } from "@/hooks/useQueries";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  Briefcase,
  ChevronRight,
  Coins,
  LayoutDashboard,
  LogOut,
  Settings,
  TrendingUp,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

export type Page =
  | "overview"
  | "portfolio"
  | "assets"
  | "transactions"
  | "settings";

interface Props {
  activePage: Page;
  onNavigate: (page: Page) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const navItems: { id: Page; icon: React.ElementType }[] = [
  { id: "overview", icon: LayoutDashboard },
  { id: "portfolio", icon: Briefcase },
  { id: "assets", icon: Coins },
  { id: "transactions", icon: ArrowLeftRight },
  { id: "settings", icon: Settings },
];

export default function Sidebar({
  activePage,
  onNavigate,
  isOpen = false,
  onClose,
}: Props) {
  const { clear, identity } = useInternetIdentity();
  const qc = useQueryClient();
  const { data: profile } = useGetProfile();
  const { t } = useTranslation();

  const handleLogout = async () => {
    await clear();
    qc.clear();
  };

  const displayName =
    profile?.displayName ||
    (identity
      ? `${identity.getPrincipal().toString().slice(0, 8)}...`
      : "User");
  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const sidebarContent = (
    <>
      {/* Logo row — on mobile shows close button */}
      <div className="px-5 pt-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-fin-green/20 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-fin-green" />
          </div>
          <span className="font-display text-xl font-bold text-foreground tracking-tight">
            Miinsolio
          </span>
        </div>
        {/* Close button — only visible on mobile/tablet */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sidebar"
          className="lg:hidden p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav
        className="flex-1 px-3 py-2 space-y-0.5"
        aria-label="Main navigation"
      >
        {navItems.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button
              type="button"
              key={item.id}
              onClick={() => onNavigate(item.id)}
              data-ocid={`nav.${item.id}.link`}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <item.icon
                className={cn(
                  "w-4 h-4 flex-shrink-0",
                  isActive ? "text-fin-green" : "",
                )}
              />
              <span>{t(`sidebar.${item.id}` as Parameters<typeof t>[0])}</span>
              {isActive && (
                <ChevronRight className="w-3 h-3 ml-auto text-fin-green" />
              )}
            </button>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 pb-4 border-t border-sidebar-border pt-3">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <motion.div
            className="w-8 h-8 rounded-full bg-fin-blue/20 flex items-center justify-center text-xs font-bold text-fin-blue flex-shrink-0"
            whileHover={{ scale: 1.05 }}
          >
            {initials}
          </motion.div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {displayName}
            </p>
            <p className="text-xs text-muted-foreground">
              {profile?.baseCurrency || "USD"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          data-ocid="nav.logout.button"
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>{t("sidebar.logout")}</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar — always visible on lg+ */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-60 bg-sidebar border-r border-sidebar-border flex-col z-30">
        {sidebarContent}
      </aside>

      {/* Mobile/tablet drawer — slides in from left */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full w-72 bg-sidebar border-r border-sidebar-border flex flex-col z-50",
          "transition-transform duration-300 ease-in-out lg:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Navigation menu"
      >
        {sidebarContent}
      </aside>
    </>
  );
}
