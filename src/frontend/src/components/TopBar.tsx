import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGetProfile } from "@/hooks/useQueries";
import { Bell, ChevronDown, Search } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Props {
  dateRange: string;
  onDateRangeChange: (range: string) => void;
}

const DATE_RANGE_KEYS = [
  "Last 7 Days",
  "Last 30 Days",
  "Last 90 Days",
  "Last Year",
  "All Time",
] as const;

export default function TopBar({ dateRange, onDateRangeChange }: Props) {
  const { data: profile } = useGetProfile();
  const { t, i18n } = useTranslation();
  const displayName = profile?.displayName || "there";

  const toggleLang = () => {
    const next = i18n.language === "vi" ? "en" : "vi";
    i18n.changeLanguage(next);
    localStorage.setItem("finfolio-lang", next);
  };

  return (
    <header className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          {t("topbar.greeting")}{" "}
          <span className="text-fin-green">{displayName}</span>!
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t("topbar.subtitle")}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t("topbar.searchPlaceholder")}
            className="pl-9 w-52 bg-muted border-border text-sm h-9"
            data-ocid="topbar.search_input"
          />
        </div>

        {/* Language switcher */}
        <button
          type="button"
          onClick={toggleLang}
          className="h-9 px-2.5 rounded-md bg-muted border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-fin-green/40 transition-colors tabular-nums"
          aria-label="Switch language"
          data-ocid="topbar.lang_switcher"
          title={
            i18n.language === "vi"
              ? "Switch to English"
              : "Chuyển sang Tiếng Việt"
          }
        >
          {i18n.language === "vi" ? "EN" : "VI"}
        </button>

        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 border-border bg-muted relative"
          data-ocid="topbar.notification.button"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-fin-green" />
        </Button>

        <div className="relative">
          <select
            value={dateRange}
            onChange={(e) => onDateRangeChange(e.target.value)}
            className="h-9 pl-3 pr-8 rounded-md bg-muted border border-border text-sm text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-fin-green"
            data-ocid="topbar.date_range.select"
          >
            {DATE_RANGE_KEYS.map((r) => (
              <option key={r} value={r}>
                {t(`topbar.dateRanges.${r}` as Parameters<typeof t>[0])}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>
      </div>
    </header>
  );
}
