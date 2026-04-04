import { Category, type Public__1 } from "@/backend.d";
import { useGetAssets } from "@/hooks/useQueries";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// Fallback map for assets saved with old uppercase format (e.g. BTC -> bitcoin)
// New assets store the CoinGecko ID directly (e.g. 'bitcoin')
const COINGECKO_ID_MAP: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  ADA: "cardano",
  XRP: "ripple",
  DOGE: "dogecoin",
  AVAX: "avalanche-2",
  DOT: "polkadot",
  MATIC: "matic-network",
  LINK: "chainlink",
  UNI: "uniswap",
  ATOM: "cosmos",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  NEAR: "near-protocol",
  APT: "aptos",
  ARB: "arbitrum",
  OP: "optimism",
  INJ: "injective-protocol",
  TON: "the-open-network",
  TRX: "tron",
};

/**
 * Resolve a crypto symbol to a CoinGecko coin ID.
 */
function getCoinGeckoId(symbol: string): string {
  return COINGECKO_ID_MAP[symbol.toUpperCase()] ?? symbol.toLowerCase();
}

/**
 * Detect if a symbol is a Vietnamese stock (ends with .VN or has old HOSE:/HNX: prefix)
 */
function isVNStock(symbol: string): boolean {
  return (
    symbol.endsWith(".VN") ||
    symbol.startsWith("HOSE:") ||
    symbol.startsWith("HNX:")
  );
}

/**
 * Convert old-format VN symbol (HOSE:VNM or HNX:SHB) to Yahoo Finance format (VNM.VN)
 */
function toYahooVNSymbol(symbol: string): string {
  if (symbol.startsWith("HOSE:") || symbol.startsWith("HNX:")) {
    const ticker = symbol.split(":")[1];
    return `${ticker}.VN`;
  }
  return symbol; // already in .VN format
}

export type PriceSource =
  | "coingecko"
  | "finnhub"
  | "frankfurter"
  | "yahoo"
  | "manual";
export type PriceStatus = "live" | "stale" | "error" | "no-key";

export interface PriceEntry {
  price: number;
  change24h: number;
  source: PriceSource;
  status: PriceStatus;
  updatedAt: number;
}

export type PriceMap = Record<string, PriceEntry>;

export interface PriceFeedContextValue {
  prices: PriceMap;
  isLoading: boolean;
  refetch: () => void;
  hasFinnhubKey: boolean;
}

export const PriceFeedContext = createContext<PriceFeedContextValue>({
  prices: {},
  isLoading: false,
  refetch: () => {},
  hasFinnhubKey: false,
});

const POLL_INTERVAL_MS = 30_000;

// Fetch prices for multiple crypto coins in one batch request
async function fetchCryptoPrices(
  symbols: string[],
): Promise<Record<string, { price: number; change24h: number }>> {
  if (symbols.length === 0) return {};
  const ids = symbols.map(getCoinGeckoId).join(",");
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_change=true`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) return {};
    const json = await res.json();
    const result: Record<string, { price: number; change24h: number }> = {};
    for (const symbol of symbols) {
      const id = getCoinGeckoId(symbol);
      const data = json[id];
      if (data?.usd) {
        result[symbol] = {
          price: data.usd,
          change24h: data.usd_24h_change ?? 0,
        };
      }
    }
    return result;
  } catch {
    return {};
  }
}

async function fetchForexPrice(
  symbol: string,
): Promise<{ price: number; change24h: number } | null> {
  const base = symbol.toUpperCase();
  if (base === "USD") return { price: 1, change24h: 0 };
  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=${base}&to=USD`,
      {
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return null;
    const json = await res.json();
    const rate = json?.rates?.USD;
    if (typeof rate !== "number") return null;
    return { price: rate, change24h: 0 };
  } catch {
    return null;
  }
}

/**
 * Fetch Vietnamese stock price from Yahoo Finance.
 * Supports both new format (VNM.VN) and old Finnhub format (HOSE:VNM).
 * Returns price in VND.
 */
async function fetchVNStockPrice(
  symbol: string,
): Promise<{ price: number; change24h: number } | null> {
  const yahooSymbol = toYahooVNSymbol(symbol);
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose;
    if (typeof price !== "number" || price === 0) return null;
    const change24h =
      typeof prevClose === "number" && prevClose !== 0
        ? ((price - prevClose) / prevClose) * 100
        : 0;
    return { price, change24h };
  } catch {
    return null;
  }
}

async function fetchStockPrice(
  symbol: string,
  key: string,
): Promise<{ price: number; change24h: number } | null> {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(key)}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const json = await res.json();
    if (typeof json?.c !== "number" || json.c === 0) return null;
    return {
      price: json.c,
      change24h: json.dp ?? 0,
    };
  } catch {
    return null;
  }
}

export function PriceFeedProvider({ children }: { children: React.ReactNode }) {
  const { data: assets } = useGetAssets();
  const [prices, setPrices] = useState<PriceMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [hasFinnhubKey, setHasFinnhubKey] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFetchingRef = useRef(false);
  const firstFetchDone = useRef(false);

  // Listen for localStorage changes (when user saves Finnhub key)
  useEffect(() => {
    const check = () => {
      const key = localStorage.getItem("finnhub_key") ?? "";
      setHasFinnhubKey(!!key.trim());
    };
    check();
    window.addEventListener("finnhub-key-updated", check);
    return () => window.removeEventListener("finnhub-key-updated", check);
  }, []);

  const fetchAllPrices = useCallback(async () => {
    if (!assets || assets.length === 0) {
      setIsLoading(false);
      return;
    }
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    const finnhubKey = localStorage.getItem("finnhub_key") ?? "";

    const cryptoAssets = assets.filter((a) => a.category === Category.Crypto);
    const forexAssets = assets.filter((a) => a.category === Category.Forex);
    const stockAssets = assets.filter((a) => a.category === Category.Stock);

    // Separate VN stocks (use Yahoo Finance) from other stocks (use Finnhub)
    const vnStockAssets = stockAssets.filter((a) => isVNStock(a.symbol));
    const otherStockAssets = stockAssets.filter((a) => !isVNStock(a.symbol));

    // Batch crypto fetch (single API call for all crypto assets)
    const cryptoSymbols = cryptoAssets.map((a) => a.symbol);

    // Run all fetches in parallel
    const [cryptoBatchResult, forexResults, vnStockResults, otherStockResults] =
      await Promise.all([
        fetchCryptoPrices(cryptoSymbols),
        Promise.all(
          forexAssets.map(async (asset) => {
            const result = await fetchForexPrice(asset.symbol);
            return { asset, result };
          }),
        ),
        // VN stocks: always use Yahoo Finance (no key needed)
        Promise.all(
          vnStockAssets.map(async (asset) => {
            const result = await fetchVNStockPrice(asset.symbol);
            return { asset, result };
          }),
        ),
        // Other stocks: use Finnhub (requires key)
        Promise.all(
          otherStockAssets.map(async (asset) => {
            if (!finnhubKey) return { asset, result: null, noKey: true };
            const result = await fetchStockPrice(asset.symbol, finnhubKey);
            return { asset, result, noKey: false };
          }),
        ),
      ]);

    const now = Date.now();
    const newPrices: PriceMap = {};

    // Process crypto results from batch
    for (const asset of cryptoAssets) {
      const result = cryptoBatchResult[asset.symbol];
      if (result) {
        newPrices[asset.symbol] = {
          price: result.price,
          change24h: result.change24h,
          source: "coingecko",
          status: "live",
          updatedAt: now,
        };
      } else {
        newPrices[asset.symbol] = {
          price: asset.manualPrice,
          change24h: 0,
          source: "manual",
          status: "error",
          updatedAt: now,
        };
      }
    }

    // Process forex results
    for (const { asset, result } of forexResults) {
      const key = asset.symbol;
      if (result) {
        newPrices[key] = {
          price: result.price,
          change24h: result.change24h,
          source: "frankfurter",
          status: "live",
          updatedAt: now,
        };
      } else {
        newPrices[key] = {
          price: asset.manualPrice,
          change24h: 0,
          source: "manual",
          status: "error",
          updatedAt: now,
        };
      }
    }

    // Process VN stock results (Yahoo Finance)
    for (const { asset, result } of vnStockResults) {
      const key = asset.symbol;
      if (result) {
        newPrices[key] = {
          price: result.price,
          change24h: result.change24h,
          source: "yahoo",
          status: "live",
          updatedAt: now,
        };
      } else {
        newPrices[key] = {
          price: asset.manualPrice,
          change24h: 0,
          source: "manual",
          status: "error",
          updatedAt: now,
        };
      }
    }

    // Process other stock results (Finnhub)
    for (const { asset, result, noKey } of otherStockResults as Array<{
      asset: Public__1;
      result: { price: number; change24h: number } | null;
      noKey?: boolean;
    }>) {
      const key = asset.symbol;
      if (noKey) {
        newPrices[key] = {
          price: asset.manualPrice,
          change24h: 0,
          source: "manual",
          status: "no-key",
          updatedAt: now,
        };
      } else if (result) {
        newPrices[key] = {
          price: result.price,
          change24h: result.change24h,
          source: "finnhub",
          status: "live",
          updatedAt: now,
        };
      } else {
        newPrices[key] = {
          price: asset.manualPrice,
          change24h: 0,
          source: "manual",
          status: "error",
          updatedAt: now,
        };
      }
    }

    // Cash assets: use manualPrice directly
    for (const asset of assets.filter((a) => a.category === Category.Cash)) {
      newPrices[asset.symbol] = {
        price: asset.manualPrice,
        change24h: 0,
        source: "manual",
        status: "live",
        updatedAt: now,
      };
    }

    setPrices((prev) => ({ ...prev, ...newPrices }));

    if (!firstFetchDone.current) {
      firstFetchDone.current = true;
      setIsLoading(false);
    }

    isFetchingRef.current = false;
  }, [assets]);

  // Run on mount and set up polling
  useEffect(() => {
    if (!assets || assets.length === 0) {
      setIsLoading(false);
      return;
    }

    fetchAllPrices();
    intervalRef.current = setInterval(fetchAllPrices, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [assets, fetchAllPrices]);

  const refetch = useCallback(() => {
    isFetchingRef.current = false;
    fetchAllPrices();
  }, [fetchAllPrices]);

  return (
    <PriceFeedContext.Provider
      value={{ prices, isLoading, refetch, hasFinnhubKey }}
    >
      {children}
    </PriceFeedContext.Provider>
  );
}

export function usePrices(): PriceFeedContextValue {
  return useContext(PriceFeedContext);
}
