import type { backendInterface } from "@/backend";
import { Category, type Public__1 } from "@/backend.d";
import { useGetAssets } from "@/hooks/useQueries";
import { useQueryClient } from "@tanstack/react-query";
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

export type PriceSource = "coingecko" | "frankfurter" | "yahoo" | "manual";
export type PriceStatus = "live" | "stale" | "error" | "no-key";

export interface PriceEntry {
  price: number;
  change24h: number;
  source: PriceSource;
  status: PriceStatus;
  updatedAt: number;
}

export type PriceMap = Record<string, PriceEntry>;

/** Callback type for when price fetch completes. Receives fresh prices and assets. */
export type OnPricesUpdatedFn = (prices: PriceMap, assets: Public__1[]) => void;

export interface PriceFeedContextValue {
  prices: PriceMap;
  isLoading: boolean;
  refetch: () => void;
  /** Register a callback to be called every time prices are successfully updated. Returns an unsubscribe function. */
  onPricesUpdated: (cb: OnPricesUpdatedFn) => () => void;
}

export const PriceFeedContext = createContext<PriceFeedContextValue>({
  prices: {},
  isLoading: false,
  refetch: () => {},
  onPricesUpdated: () => () => {},
});

const POLL_INTERVAL_MS = 30_000;

/**
 * Get the best available actor from queryClient cache.
 * Prefers authenticated actors (non-anonymous principal) over anonymous ones.
 */
function getActorFromCache(
  qc: ReturnType<typeof useQueryClient>,
): backendInterface | null {
  const queries = qc.getQueriesData<backendInterface>({ queryKey: ["actor"] });
  let bestActor: backendInterface | null = null;
  for (const [queryKey, data] of queries) {
    if (!data) continue;
    const principal = queryKey[1] as string | undefined;
    if (principal && principal !== "undefined" && principal !== "2vxsx-fae") {
      return data; // authenticated actor -- use immediately
    }
    bestActor = data;
  }
  return bestActor;
}

// Batch crypto fetch (single API call for all crypto assets)
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

export function PriceFeedProvider({ children }: { children: React.ReactNode }) {
  const [prices, setPrices] = useState<PriceMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFetchingRef = useRef(false);
  const firstFetchDone = useRef(false);
  const listenersRef = useRef<Set<OnPricesUpdatedFn>>(new Set());
  const { data: assets } = useGetAssets();
  const queryClient = useQueryClient();

  const fetchAllPrices = useCallback(async () => {
    if (!assets || assets.length === 0) {
      setIsLoading(false);
      return;
    }
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    const actor = getActorFromCache(queryClient);

    const cryptoAssets = assets.filter((a) => a.category === Category.Crypto);
    const forexAssets = assets.filter((a) => a.category === Category.Forex);
    const stockAssets = assets.filter((a) => a.category === Category.Stock);

    const cryptoSymbols = cryptoAssets.map((a) => a.symbol);

    // Run all fetches in parallel
    const [cryptoBatchResult, forexResults, stockResults] = await Promise.all([
      fetchCryptoPrices(cryptoSymbols),
      Promise.all(
        forexAssets.map(async (asset) => {
          const result = await fetchForexPrice(asset.symbol);
          return { asset, result };
        }),
      ),
      // All stocks: use backend actor (proxies Yahoo Finance via http-outcalls, no CORS)
      Promise.all(
        stockAssets.map(async (asset) => {
          if (actor?.getStockPrice) {
            try {
              const res = await actor.getStockPrice(asset.symbol);
              if (res.ok && res.price > 0) {
                return {
                  asset,
                  result: { price: res.price, change24h: res.change24h },
                };
              }
            } catch {
              // actor call failed, fall through to error state
            }
          }
          return { asset, result: null };
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

    // Process stock results (Yahoo Finance via backend)
    for (const { asset, result } of stockResults) {
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

    setPrices((prev) => {
      const merged = { ...prev, ...newPrices };
      // Notify all listeners with the fresh merged prices
      for (const listener of listenersRef.current) {
        try {
          listener(merged, assets);
        } catch {
          // ignore listener errors
        }
      }
      return merged;
    });

    if (!firstFetchDone.current) {
      firstFetchDone.current = true;
      setIsLoading(false);
    }

    isFetchingRef.current = false;
  }, [assets, queryClient]);

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

  const onPricesUpdated = useCallback((cb: OnPricesUpdatedFn) => {
    listenersRef.current.add(cb);
    return () => {
      listenersRef.current.delete(cb);
    };
  }, []);

  return (
    <PriceFeedContext.Provider
      value={{ prices, isLoading, refetch, onPricesUpdated }}
    >
      {children}
    </PriceFeedContext.Provider>
  );
}

export function usePrices(): PriceFeedContextValue {
  return useContext(PriceFeedContext);
}
