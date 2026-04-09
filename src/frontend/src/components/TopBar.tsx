import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGetProfile } from "@/hooks/useQueries";
import { Bell, ChevronDown, Search } from "lucide-react";

interface Props {
  dateRange: string;
  onDateRangeChange: (range: string) => void;
}

const DATE_RANGES = [
  "Last 7 Days",
  "Last 30 Days",
  "Last 90 Days",
  "Last Year",
  "All Time",
];

export default function TopBar({ dateRange, onDateRangeChange }: Props) {
  const { data: profile } = useGetProfile();
  const displayName = profile?.displayName || "there";

  return (
    <header className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Welcome back, <span className="text-fin-green">{displayName}</span>!
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Here’s what’s happening with your portfolio.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search assets..."
            className="pl-9 w-52 bg-muted border-border text-sm h-9"
            data-ocid="topbar.search_input"
          />
        </div>

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
            {DATE_RANGES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>
      </div>
    </header>
  );
}
