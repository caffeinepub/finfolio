import { Category } from "@/backend.d";
import { Input } from "@/components/ui/input";
import { Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface SearchResult {
  symbol: string; // stored ID (e.g. 'bitcoin' for crypto, 'VNM.VN' for VN stock, 'AAPL' for US stock)
  name: string;
  displaySymbol?: string; // shown in UI (e.g. 'BTC', 'VNM')
  price?: number;
  exchange?: string; // e.g. 'HOSE', 'HNX', 'NASDAQ'
}

interface AssetSearchInputProps {
  category: Category;
  finnhubKey: string;
  onSelect: (result: { symbol: string; name: string }) => void;
  selectedSymbol?: string;
  selectedName?: string;
  onClear: () => void;
}

// Popular global stocks (fallback when no Finnhub key)
const POPULAR_STOCKS: SearchResult[] = [
  { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ" },
  { symbol: "MSFT", name: "Microsoft Corp.", exchange: "NASDAQ" },
  { symbol: "GOOGL", name: "Alphabet Inc.", exchange: "NASDAQ" },
  { symbol: "AMZN", name: "Amazon.com Inc.", exchange: "NASDAQ" },
  { symbol: "TSLA", name: "Tesla Inc.", exchange: "NASDAQ" },
  { symbol: "META", name: "Meta Platforms", exchange: "NASDAQ" },
  { symbol: "NVDA", name: "NVIDIA Corp.", exchange: "NASDAQ" },
  { symbol: "JPM", name: "JPMorgan Chase", exchange: "NYSE" },
  { symbol: "V", name: "Visa Inc.", exchange: "NYSE" },
  { symbol: "BRK.B", name: "Berkshire Hathaway", exchange: "NYSE" },
  { symbol: "JNJ", name: "Johnson & Johnson", exchange: "NYSE" },
  { symbol: "WMT", name: "Walmart Inc.", exchange: "NYSE" },
];

// Vietnamese stocks using Yahoo Finance symbol format ({TICKER}.VN)
// Yahoo Finance uses .VN suffix for all Vietnamese stocks (both HOSE and HNX)
const VN_STOCKS: SearchResult[] = [
  {
    symbol: "VNM.VN",
    name: "Vinamilk",
    displaySymbol: "VNM",
    exchange: "HOSE",
  },
  {
    symbol: "VIC.VN",
    name: "Vingroup",
    displaySymbol: "VIC",
    exchange: "HOSE",
  },
  {
    symbol: "VHM.VN",
    name: "Vinhomes",
    displaySymbol: "VHM",
    exchange: "HOSE",
  },
  {
    symbol: "HPG.VN",
    name: "Hoa Phat Group",
    displaySymbol: "HPG",
    exchange: "HOSE",
  },
  {
    symbol: "FPT.VN",
    name: "FPT Corporation",
    displaySymbol: "FPT",
    exchange: "HOSE",
  },
  {
    symbol: "MWG.VN",
    name: "Mobile World (The Gioi Di Dong)",
    displaySymbol: "MWG",
    exchange: "HOSE",
  },
  {
    symbol: "TCB.VN",
    name: "Techcombank",
    displaySymbol: "TCB",
    exchange: "HOSE",
  },
  {
    symbol: "VCB.VN",
    name: "Vietcombank",
    displaySymbol: "VCB",
    exchange: "HOSE",
  },
  { symbol: "BID.VN", name: "BIDV", displaySymbol: "BID", exchange: "HOSE" },
  {
    symbol: "CTG.VN",
    name: "VietinBank",
    displaySymbol: "CTG",
    exchange: "HOSE",
  },
  { symbol: "MBB.VN", name: "MB Bank", displaySymbol: "MBB", exchange: "HOSE" },
  {
    symbol: "ACB.VN",
    name: "Asia Commercial Bank",
    displaySymbol: "ACB",
    exchange: "HOSE",
  },
  { symbol: "VPB.VN", name: "VPBank", displaySymbol: "VPB", exchange: "HOSE" },
  {
    symbol: "STB.VN",
    name: "Sacombank",
    displaySymbol: "STB",
    exchange: "HOSE",
  },
  {
    symbol: "GAS.VN",
    name: "PetroVietnam Gas",
    displaySymbol: "GAS",
    exchange: "HOSE",
  },
  {
    symbol: "PLX.VN",
    name: "Petrolimex",
    displaySymbol: "PLX",
    exchange: "HOSE",
  },
  {
    symbol: "POW.VN",
    name: "PetroVietnam Power",
    displaySymbol: "POW",
    exchange: "HOSE",
  },
  {
    symbol: "MSN.VN",
    name: "Masan Group",
    displaySymbol: "MSN",
    exchange: "HOSE",
  },
  { symbol: "SAB.VN", name: "Sabeco", displaySymbol: "SAB", exchange: "HOSE" },
  {
    symbol: "REE.VN",
    name: "REE Corporation",
    displaySymbol: "REE",
    exchange: "HOSE",
  },
  {
    symbol: "DXG.VN",
    name: "Dat Xanh Group",
    displaySymbol: "DXG",
    exchange: "HOSE",
  },
  {
    symbol: "NVL.VN",
    name: "Novaland",
    displaySymbol: "NVL",
    exchange: "HOSE",
  },
  {
    symbol: "PDR.VN",
    name: "Phat Dat Real Estate",
    displaySymbol: "PDR",
    exchange: "HOSE",
  },
  { symbol: "SHB.VN", name: "SHB Bank", displaySymbol: "SHB", exchange: "HNX" },
  {
    symbol: "PVS.VN",
    name: "PetroVietnam Technical Services",
    displaySymbol: "PVS",
    exchange: "HNX",
  },
  {
    symbol: "VGS.VN",
    name: "Viet General Steel",
    displaySymbol: "VGS",
    exchange: "HNX",
  },
  {
    symbol: "CEO.VN",
    name: "C.E.O Group",
    displaySymbol: "CEO",
    exchange: "HNX",
  },
];

// Combined default stock list (VN first, then global)
const ALL_POPULAR_STOCKS: SearchResult[] = [...VN_STOCKS, ...POPULAR_STOCKS];

// Static forex list
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

async function searchStocks(
  query: string,
  finnhubKey: string,
): Promise<{ results: SearchResult[]; usedKey: boolean }> {
  const q = query.toLowerCase().trim();

  if (!finnhubKey.trim()) {
    // Filter static list (VN + global) — no Finnhub key needed for VN stocks
    const filtered = ALL_POPULAR_STOCKS.filter(
      (s) =>
        s.symbol.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        // Allow search by ticker without .VN suffix (e.g. "VNM" matches "VNM.VN")
        (s.displaySymbol ?? s.symbol)
          .toLowerCase()
          .includes(q),
    ).slice(0, 10);
    return {
      results: filtered.length > 0 ? filtered : ALL_POPULAR_STOCKS.slice(0, 10),
      usedKey: false,
    };
  }

  if (!q) {
    return { results: ALL_POPULAR_STOCKS.slice(0, 10), usedKey: true };
  }

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${encodeURIComponent(finnhubKey)}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return { results: [], usedKey: true };
    const json = await res.json();
    if (!Array.isArray(json?.result)) return { results: [], usedKey: true };
    const results = json.result
      .filter(
        (item: { type: string; exchange?: string }) =>
          item.type === "Common Stock" ||
          item.type === "EQS" ||
          item.exchange === "HOSE" ||
          item.exchange === "HNX",
      )
      .slice(0, 10)
      .map(
        (item: {
          symbol: string;
          description: string;
          exchange?: string;
          displaySymbol?: string;
        }) => {
          // Convert Finnhub VN symbols (HOSE:VNM) to Yahoo Finance format (VNM.VN)
          let symbol = item.symbol;
          let displaySymbol =
            item.displaySymbol ?? item.symbol.split(":").pop();
          if (
            item.exchange === "HOSE" ||
            item.exchange === "HNX" ||
            item.symbol.includes(":")
          ) {
            const ticker = item.symbol.split(":").pop() ?? item.symbol;
            symbol = `${ticker}.VN`;
            displaySymbol = ticker;
          }
          return {
            symbol,
            name: item.description,
            exchange: item.exchange,
            displaySymbol,
          };
        },
      );
    return { results, usedKey: true };
  } catch {
    return { results: [], usedKey: true };
  }
}

function filterForex(query: string): SearchResult[] {
  if (!query.trim()) return FOREX_LIST;
  const q = query.toLowerCase();
  return FOREX_LIST.filter(
    (s) =>
      s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
  );
}

function formatPrice(price: number): string {
  if (price >= 1000)
    return `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
}

export function AssetSearchInput({
  category,
  finnhubKey,
  onSelect,
  selectedSymbol,
  selectedName,
  onClear,
}: AssetSearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [noKeyNote, setNoKeyNote] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

    if (category === Category.Forex) {
      setResults(filterForex(q));
      setDropdownOpen(true);
      return;
    }

    if (category === Category.Stock && !finnhubKey && !q.trim()) {
      setResults(ALL_POPULAR_STOCKS.slice(0, 10));
      setNoKeyNote(false); // VN stocks don't need Finnhub key
      setDropdownOpen(true);
      return;
    }

    if (category === Category.Crypto && !q.trim()) {
      setIsSearching(true);
      searchCrypto("").then((res) => {
        setResults(res);
        setDropdownOpen(true);
        setIsSearching(false);
      });
      return;
    }

    if (!q.trim()) {
      if (category === Category.Stock) {
        setResults(ALL_POPULAR_STOCKS.slice(0, 10));
        setNoKeyNote(false);
        setDropdownOpen(true);
      } else {
        setResults([]);
        setDropdownOpen(false);
      }
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        if (category === Category.Crypto) {
          const res = await searchCrypto(q);
          setResults(res);
          setDropdownOpen(true);
        } else if (category === Category.Stock) {
          const { results: res, usedKey } = await searchStocks(q, finnhubKey);
          setResults(res);
          setNoKeyNote(
            !usedKey &&
              res.length > 0 &&
              res.some((r) => !r.symbol.endsWith(".VN")),
          );
          setDropdownOpen(true);
        }
      } finally {
        setIsSearching(false);
      }
    }, 400);
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
  };

  // If asset already selected, show badge mode
  if (selectedSymbol) {
    return (
      <div
        className="flex items-center gap-2 p-2.5 rounded-md bg-muted border border-fin-green/40"
        data-ocid="assets.search.panel"
      >
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-xs font-bold font-mono text-fin-green">
            {selectedSymbol.endsWith(".VN")
              ? selectedSymbol.replace(".VN", "")
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

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          value={query}
          onChange={handleQueryChange}
          onFocus={handleFocus}
          placeholder="Search by name or symbol (e.g. VNM, FPT, AAPL)..."
          className="bg-muted border-border pr-8"
          autoComplete="off"
          data-ocid="assets.search.input"
        />
        {isSearching && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {dropdownOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
          {noKeyNote && (
            <div className="px-3 py-1.5 border-b border-border bg-muted/50">
              <p className="text-[11px] text-muted-foreground">
                Danh sách phổ biến — Cài Finnhub key trong Settings để tìm kiếm
                cổ phiếu quốc tế đầy đủ hơn
              </p>
            </div>
          )}
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
                      {result.displaySymbol ??
                        (result.symbol.endsWith(".VN")
                          ? result.symbol.replace(".VN", "")
                          : result.symbol.includes(":")
                            ? result.symbol.split(":").pop()!.toUpperCase()
                            : result.symbol.toUpperCase())}
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

      {dropdownOpen && results.length === 0 && query.trim() && !isSearching && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg">
          <p className="px-3 py-3 text-xs text-muted-foreground text-center">
            Không tìm thấy kết quả cho &ldquo;{query}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
