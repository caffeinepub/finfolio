import { Category } from "@/backend.d";
import { Input } from "@/components/ui/input";
import { useActor } from "@/hooks/useActor";
import { Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface SearchResult {
  symbol: string; // stored ID (e.g. 'bitcoin' for crypto, 'VNM.VN' for VN stock, 'AAPL' for US stock)
  name: string;
  displaySymbol?: string; // shown in UI (e.g. 'BTC', 'VNM')
  price?: number;
  exchange?: string; // e.g. 'HOSE', 'HNX', 'NASDAQ'
  isCustom?: boolean; // user-entered symbol not in static list
}

interface AssetSearchInputProps {
  category: Category;
  onSelect: (result: { symbol: string; name: string }) => void;
  selectedSymbol?: string;
  selectedName?: string;
  onClear: () => void;
}

// Static forex list (Frankfurter has no search endpoint)
const FOREX_LIST: SearchResult[] = [
  { symbol: "EUR", name: "Euro" },
  { symbol: "GBP", name: "British Pound" },
  { symbol: "JPY", name: "Japanese Yen" },
  { symbol: "CHF", name: "Swiss Franc" },
  { symbol: "AUD", name: "Australian Dollar" },
  { symbol: "CAD", name: "Canadian Dollar" },
  { symbol: "CNY", name: "Chinese Yuan" },
  { symbol: "HKD", name: "Hong Kong Dollar" },
  { symbol: "SGD", name: "Singapore Dollar" },
  { symbol: "VND", name: "Vietnamese Dong" },
  { symbol: "KRW", name: "South Korean Won" },
  { symbol: "INR", name: "Indian Rupee" },
  { symbol: "THB", name: "Thai Baht" },
  { symbol: "MXN", name: "Mexican Peso" },
  { symbol: "BRL", name: "Brazilian Real" },
];

function filterForex(query: string): SearchResult[] {
  if (!query.trim()) return FOREX_LIST;
  const q = query.toLowerCase();
  return FOREX_LIST.filter(
    (s) =>
      s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
  );
}

// CoinGecko search - free, no key required
async function searchCrypto(query: string): Promise<SearchResult[]> {
  if (!query.trim()) {
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1",
        { signal: AbortSignal.timeout(8000) },
      );
      if (!res.ok) return [];
      const json = await res.json();
      if (!Array.isArray(json)) return [];
      return json.map(
        (item: {
          id: string;
          symbol: string;
          name: string;
          current_price?: number;
        }) => ({
          symbol: item.id,
          name: item.name,
          displaySymbol: item.symbol?.toUpperCase(),
          price: item.current_price,
        }),
      );
    } catch {
      return [];
    }
  }
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return [];
    const json = await res.json();
    if (!Array.isArray(json?.coins)) return [];
    return json.coins
      .slice(0, 8)
      .map((item: { id: string; symbol: string; name: string }) => ({
        symbol: item.id,
        name: item.name,
        displaySymbol: item.symbol?.toUpperCase(),
      }));
  } catch {
    return [];
  }
}

function formatPrice(price: number): string {
  if (price >= 1000)
    return `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
}

/**
 * Map Yahoo Finance exchange codes to human-readable names
 */
function mapExchange(exchangeCode: string): string {
  const map: Record<string, string> = {
    NMS: "NASDAQ",
    NYQ: "NYSE",
    NGM: "NASDAQ",
    PCX: "NYSE Arca",
    HNX: "HNX",
    HSX: "HOSE",
    VNM: "HOSE",
    TKS: "TSE",
    FRA: "FSE",
    LSE: "LSE",
    ASX: "ASX",
    TSX: "TSX",
  };
  return map[exchangeCode] ?? exchangeCode;
}

export function AssetSearchInput({
  category,
  onSelect,
  selectedSymbol,
  selectedName,
  onClear,
}: AssetSearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [stockSearchError, setStockSearchError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { actor } = useActor();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFocus = () => {
    setDropdownOpen(true);
    if (results.length === 0 && !query) {
      triggerSearch("");
    }
  };

  const triggerSearch = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setStockSearchError(null);

    if (category === Category.Forex) {
      setResults(filterForex(q));
      setDropdownOpen(true);
      return;
    }

    if (category === Category.Crypto) {
      if (!q.trim()) {
        setIsSearching(true);
        searchCrypto("").then((res) => {
          setResults(res);
          setDropdownOpen(true);
          setIsSearching(false);
        });
        return;
      }
      debounceRef.current = setTimeout(async () => {
        setIsSearching(true);
        try {
          const res = await searchCrypto(q);
          setResults(res);
          setDropdownOpen(true);
        } finally {
          setIsSearching(false);
        }
      }, 400);
      return;
    }

    if (category === Category.Stock) {
      // Require at least 1 char to trigger stock search
      if (!q.trim()) {
        setResults([]);
        setDropdownOpen(false);
        return;
      }

      // Debounce: min 2 chars for stock search to avoid excessive calls
      if (q.trim().length < 2) {
        setResults([]);
        setDropdownOpen(true);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        setIsSearching(true);
        setStockSearchError(null);
        try {
          if (!actor) {
            setStockSearchError("Not connected — please wait and try again");
            setResults([]);
            setDropdownOpen(true);
            return;
          }
          const backendResults = await actor.searchStocks(q.trim());
          const mapped: SearchResult[] = backendResults.map((r) => ({
            symbol: r.symbol,
            name: r.name,
            displaySymbol: r.symbol.includes(".")
              ? r.symbol.split(".")[0]
              : r.symbol,
            exchange: r.exchange ? mapExchange(r.exchange) : undefined,
          }));
          setResults(mapped);
          setDropdownOpen(true);
        } catch {
          setStockSearchError("Search failed — check your connection");
          setResults([]);
          setDropdownOpen(true);
        } finally {
          setIsSearching(false);
        }
      }, 500);
      return;
    }
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    triggerSearch(val);
  };

  const handleSelect = (result: SearchResult) => {
    onSelect({ symbol: result.symbol, name: result.name });
    setDropdownOpen(false);
    setQuery("");
    setResults([]);
    setStockSearchError(null);
  };

  const showDropdown = dropdownOpen && results.length > 0;
  const showNoResults =
    dropdownOpen &&
    results.length === 0 &&
    query.trim().length >= 2 &&
    !isSearching &&
    !stockSearchError &&
    category === Category.Stock;
  const showError = dropdownOpen && !!stockSearchError && !isSearching;
  const showHint =
    dropdownOpen &&
    results.length === 0 &&
    query.trim().length === 1 &&
    !isSearching &&
    category === Category.Stock;

  // If asset already selected, show badge mode
  if (selectedSymbol) {
    return (
      <div
        className="flex items-center gap-2 p-2.5 rounded-md bg-muted border border-fin-green/40"
        data-ocid="assets.search.panel"
      >
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-xs font-bold font-mono text-fin-green">
            {selectedSymbol.includes(".")
              ? selectedSymbol.split(".")[0]
              : selectedSymbol.includes(":")
                ? selectedSymbol.split(":").pop()!.toUpperCase()
                : selectedSymbol.toUpperCase()}
          </span>
          <span className="text-xs text-muted-foreground truncate">
            {selectedName}
          </span>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
          aria-label="Clear selection"
          data-ocid="assets.search.close_button"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  const placeholder =
    category === Category.Stock
      ? "Gõ tên hoặc mã cổ phiếu (AAPL, VNM, TSLA...)..."
      : category === Category.Crypto
        ? "Tìm theo tên hoặc mã (bitcoin, BTC, ETH...)..."
        : "Tìm đơn vị tiền tệ (USD, EUR, VND...)...";

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          value={query}
          onChange={handleQueryChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="bg-muted border-border pr-8"
          autoComplete="off"
          data-ocid="assets.search.input"
        />
        {isSearching && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Hint: type more chars */}
      {showHint && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg">
          <p className="px-3 py-3 text-xs text-muted-foreground text-center">
            Nhập ít nhất 2 ký tự để tìm kiếm...
          </p>
        </div>
      )}

      {/* Error state */}
      {showError && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg">
          <p className="px-3 py-3 text-xs text-red-400 text-center">
            {stockSearchError}
          </p>
        </div>
      )}

      {/* Results dropdown */}
      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
          <ul className="max-h-64 overflow-y-auto">
            {results.map((result) => (
              <li key={result.symbol}>
                <button
                  type="button"
                  onClick={() => handleSelect(result)}
                  className="w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xs font-bold font-mono text-fin-green shrink-0">
                      {result.displaySymbol ?? result.symbol.toUpperCase()}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs text-muted-foreground truncate group-hover:text-foreground transition-colors">
                        {result.name}
                      </span>
                      {result.exchange && (
                        <span className="text-[10px] text-muted-foreground/60">
                          {result.exchange}
                        </span>
                      )}
                    </div>
                  </div>
                  {result.price !== undefined && (
                    <span className="text-xs font-mono text-foreground shrink-0">
                      {formatPrice(result.price)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* No results */}
      {showNoResults && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg">
          <p className="px-3 py-3 text-xs text-muted-foreground text-center">
            Không tìm thấy kết quả cho &ldquo;{query}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
