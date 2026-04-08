import { Category, type Public__1 } from "@/backend.d";
import { METAL_SYMBOLS, OIL_SYMBOLS } from "@/components/AssetSearchInput";
import { useActor } from "@/hooks/useActor";
import { useGetAssets } from "@/hooks/useQueries";
import { convertCurrency } from "@/utils/formatters";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// Fallback map for assets saved with old uppercase format (e.g. BTC -> bitcoin)
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
  NEAR: "near",
  APT: "aptos",
  ARB: "arbitrum",
  OP: "optimism",
  INJ: "injective-protocol",
  TON: "toncoin",
  TRX: "tron",
};

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

/**
 * Exchange rates vs USD — used for currency conversion throughout the app.
 * Key: currency code (e.g. "USD", "VND", "EUR"). Value: USD per 1 unit of that currency.
 * For VND: rates["VND"] = 0.000040 (approx)
 * For EUR: rates["EUR"] = 1.08 (approx)
 */
export type ExchangeRates = Record<string, number>;

export interface PriceFeedContextValue {
  prices: PriceMap;
  isLoading: boolean;
  refetch: () => void;
  /** Exchange rates vs USD (from Frankfurter). Key = currency code, value = USD equivalent of 1 unit */
  exchangeRates: ExchangeRates;
  /** Convert amount from one currency to another using live exchange rates */
  convert: (amount: number, from: string, to: string) => number;
  /** Register a callback to be called every time prices are successfully updated. Returns an unsubscribe function. */
  onPricesUpdated: (cb: OnPricesUpdatedFn) => () => void;
}

export const PriceFeedContext = createContext<PriceFeedContextValue>({
  prices: {},
  isLoading: false,
  refetch: () => {},
  exchangeRates: { USD: 1, VND: 1 / 25350 },
  convert: (amount) => amount,
  onPricesUpdated: () => () => {},
});

const POLL_INTERVAL_MS = 30_000;
// Major currencies to prefetch for conversion
const PREFETCH_CURRENCIES = [
  "EUR",
  "GBP",
  "JPY",
  "VND",
  "AUD",
  "CAD",
  "CHF",
  "SGD",
  "HKD",
  "KRW",
];

async function fetchCryptoPrices(
  symbols: string[],
): Promise<Record<string, { price: number; change24h: number }>> {
  if (symbols.length === 0) return {};

  // Map each symbol to its CoinGecko ID (handles both "bitcoin" already and "BTC" shorthand)
  const symbolToId = new Map<string, string>();
  for (const symbol of symbols) {
    symbolToId.set(symbol, getCoinGeckoId(symbol));
  }
  const uniqueIds = [...new Set(symbolToId.values())];
  const ids = uniqueIds.join(",");

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_change=true`;

    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) {
      console.warn(`[PriceFeed] CoinGecko returned ${res.status}`);
      return {};
    }
    const json = (await res.json()) as Record<
      string,
      { usd?: number; usd_24h_change?: number }
    >;

    const result: Record<string, { price: number; change24h: number }> = {};
    for (const symbol of symbols) {
      const id = symbolToId.get(symbol) ?? getCoinGeckoId(symbol);
      const data = json[id];
      if (data && typeof data.usd === "number" && data.usd > 0) {
        result[symbol] = {
          price: data.usd,
          change24h: data.usd_24h_change ?? 0,
        };
      }
    }
    return result;
  } catch (err) {
    console.warn("[PriceFeed] CoinGecko fetch error:", err);
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
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { rates?: Record<string, number> };
    const rate = json?.rates?.USD;
    if (typeof rate !== "number") return null;
    return { price: rate, change24h: 0 };
  } catch {
    return null;
  }
}

/**
 * Fetch VND/USD rate from open currency API (Frankfurter does not support VND).
 * Returns how many USD 1 VND is worth (≈ 0.00004).
 */
async function fetchVndRate(): Promise<number | null> {
  try {
    // Open exchange rate CDN — free, no key, updated daily
    const res = await fetch(
      "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json",
      { signal: AbortSignal.timeout(8000) },
    );
    if (res.ok) {
      const json = (await res.json()) as { usd?: Record<string, number> };
      const usdRates = json?.usd ?? {};
      const vndPerUsd = usdRates.vnd;
      if (typeof vndPerUsd === "number" && vndPerUsd > 1000) {
        // vndPerUsd ≈ 25000 → 1 VND = 1/25000 USD
        return 1 / vndPerUsd;
      }
    }
  } catch {
    // ignore
  }
  // Fallback: try exchangerate-api
  try {
    const res2 = await fetch("https://api.exchangerate-api.com/v4/latest/USD", {
      signal: AbortSignal.timeout(8000),
    });
    if (res2.ok) {
      const json2 = (await res2.json()) as { rates?: Record<string, number> };
      const vndPerUsd = json2?.rates?.VND;
      if (typeof vndPerUsd === "number" && vndPerUsd > 1000) {
        return 1 / vndPerUsd;
      }
    }
  } catch {
    // ignore
  }
  // Last-resort fallback: approximate VND/USD rate
  return 1 / 25350;
}

/**
 * Fetch exchange rates for a batch of currencies vs USD using Frankfurter.
 * Returns a map: currency -> USD per 1 unit of that currency.
 * Note: Frankfurter does NOT support VND — handled separately via fetchVndRate().
 */
async function fetchExchangeRates(
  currencies: string[],
): Promise<ExchangeRates> {
  const rates: ExchangeRates = { USD: 1 };
  if (currencies.length === 0) return rates;

  // Filter out non-fiat currencies (BTC, ETH handled separately via price feed)
  // Also filter VND since Frankfurter doesn't support it — fetched separately
  const fiatCurrencies = currencies.filter(
    (c) => !["BTC", "ETH", "USD", "VND"].includes(c.toUpperCase()),
  );

  const [frankfurterResult, vndRate] = await Promise.all([
    fiatCurrencies.length > 0
      ? (async () => {
          try {
            // Frankfurter: from=USD gives how many units of each currency per 1 USD
            // We want the inverse: USD per 1 unit of each currency
            const targets = fiatCurrencies.join(",");
            const res = await fetch(
              `https://api.frankfurter.app/latest?from=USD&to=${targets}`,
              { signal: AbortSignal.timeout(8000) },
            );
            if (!res.ok) return null;
            return (await res.json()) as { rates?: Record<string, number> };
          } catch {
            return null;
          }
        })()
      : Promise.resolve(null),
    currencies.some((c) => c.toUpperCase() === "VND")
      ? fetchVndRate()
      : Promise.resolve(null),
  ]);

  if (frankfurterResult?.rates) {
    for (const [cur, val] of Object.entries(frankfurterResult.rates)) {
      if (typeof val === "number" && val > 0) {
        // json.rates[EUR] = ~0.92 means 1 USD = 0.92 EUR → 1 EUR = 1/0.92 USD ≈ 1.087
        rates[cur.toUpperCase()] = 1 / val;
      }
    }
  }

  // Always include VND rate (either fetched or fallback)
  if (vndRate !== null && vndRate > 0) {
    rates.VND = vndRate;
  } else {
    // Ensure VND always has a fallback so USD→VND conversions never fall through
    rates.VND = rates.VND ?? 1 / 25350;
  }

  return rates;
}

export function PriceFeedProvider({ children }: { children: React.ReactNode }) {
  const [prices, setPrices] = useState<PriceMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>({
    USD: 1,
    VND: 1 / 25350,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFetchingRef = useRef(false);
  const firstFetchDone = useRef(false);
  const listenersRef = useRef<Set<OnPricesUpdatedFn>>(new Set());
  // Cache: last successfully fetched prices per symbol — prevents zero values on API failure
  const pricesCacheRef = useRef<PriceMap>({});
  const { data: assets } = useGetAssets();
  const { actor } = useActor();

  // Build the convert function using current exchangeRates and crypto prices
  const convert = useCallback(
    (amount: number, from: string, to: string): number => {
      const from_ = from.toUpperCase();
      const to_ = to.toUpperCase();
      if (from_ === to_) return amount;

      // Build a combined rates map including crypto prices (crypto → USD)
      const combinedRates: ExchangeRates = { ...exchangeRates };
      // Add crypto rates from prices (price is already in USD)
      for (const [symbol, entry] of Object.entries(prices)) {
        if (["BTC", "ETH"].includes(symbol.toUpperCase()) && entry.price > 0) {
          combinedRates[symbol.toUpperCase()] = entry.price; // 1 BTC = price USD
        }
      }

      return convertCurrency(amount, from_, to_, combinedRates);
    },
    [exchangeRates, prices],
  );

  const fetchAllPrices = useCallback(async () => {
    if (!assets || assets.length === 0) {
      setIsLoading(false);
      return;
    }
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    const cryptoAssets = assets.filter((a) => a.category === Category.Crypto);
    const forexAssets = assets.filter((a) => a.category === Category.Forex);
    const stockAssets = assets.filter((a) => a.category === Category.Stock);
    const commodityAssets = assets.filter(
      (a) => a.category === Category.Commodity,
    );

    // Split commodity assets by price source
    const metalAssets = commodityAssets.filter((a) =>
      METAL_SYMBOLS.has(a.symbol.toUpperCase()),
    );
    const oilAssets = commodityAssets.filter((a) =>
      OIL_SYMBOLS.has(a.symbol.toUpperCase()),
    );

    // Yahoo Finance futures symbol mapping for metals
    const METAL_TO_YAHOO: Record<string, string> = {
      XAU: "GC=F",
      XAG: "SI=F",
      XPT: "PL=F",
      XPD: "PA=F",
    };

    // Collect all asset currencies for exchange rate prefetch
    const assetCurrencies = [
      ...new Set(assets.map((a) => a.currency.toUpperCase())),
    ];
    const allCurrenciesToFetch = [
      ...new Set([...PREFETCH_CURRENCIES, ...assetCurrencies]),
    ].filter((c) => !["BTC", "ETH", "USD"].includes(c));

    const cryptoSymbols = cryptoAssets.map((a) => a.symbol);

    // Build per-metal fetch promises via Yahoo Finance futures symbols
    const metalFetchPromises = metalAssets.map(async (asset) => {
      const sym = asset.symbol.toUpperCase();
      const yahooSymbol = METAL_TO_YAHOO[sym];
      if (!yahooSymbol) {
        console.warn(
          `[PriceFeed] No Yahoo futures symbol mapping for metal: ${sym}`,
        );
        // If no mapping, try fetching with the asset symbol directly (last resort)
        if (actor?.getStockPrice) {
          try {
            const res = await actor.getStockPrice(sym);
            if (res.ok && res.price > 0) {
              return {
                asset,
                result: { price: res.price, change24h: res.change24h },
              };
            }
          } catch {
            /* ignore */
          }
        }
        return { asset, result: null };
      }
      if (actor?.getStockPrice) {
        try {
          const res = await actor.getStockPrice(yahooSymbol);
          if (res.ok && res.price > 0) {
            return {
              asset,
              result: { price: res.price, change24h: res.change24h },
            };
          }
          console.warn(
            `[PriceFeed] Metal price fetch returned no data for ${sym} (${yahooSymbol}): ok=${res.ok}, price=${res.price}`,
          );
          // Retry once with the asset symbol itself as fallback
          try {
            const res2 = await actor.getStockPrice(sym);
            if (res2.ok && res2.price > 0) {
              return {
                asset,
                result: { price: res2.price, change24h: res2.change24h },
              };
            }
          } catch {
            /* ignore */
          }
        } catch (err) {
          console.warn(
            `[PriceFeed] Metal price fetch failed for ${sym} (${yahooSymbol}):`,
            err,
          );
        }
      }
      return { asset, result: null };
    });

    // Oil symbols via Yahoo Finance (same path as stocks)
    const oilFetchPromises = oilAssets.map(async (asset) => {
      if (actor?.getStockPrice) {
        try {
          const res = await actor.getStockPrice(asset.symbol);
          if (res.ok && res.price > 0) {
            return {
              asset,
              result: { price: res.price, change24h: res.change24h },
            };
          }
          console.warn(
            `[PriceFeed] Oil price fetch returned no data for ${asset.symbol}: ok=${res.ok}, price=${res.price}`,
          );
        } catch (err) {
          console.warn(
            `[PriceFeed] Oil price fetch failed for ${asset.symbol}:`,
            err,
          );
        }
      }
      return { asset, result: null };
    });

    const [
      cryptoBatchResult,
      forexResults,
      stockResults,
      freshRates,
      metalResults,
      oilResults,
    ] = await Promise.all([
      fetchCryptoPrices(cryptoSymbols),
      Promise.all(
        forexAssets.map(async (asset) => {
          const result = await fetchForexPrice(asset.symbol);
          return { asset, result };
        }),
      ),
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
              // fall through
            }
          }
          return { asset, result: null };
        }),
      ),
      fetchExchangeRates(allCurrenciesToFetch),
      Promise.all(metalFetchPromises),
      Promise.all(oilFetchPromises),
    ]);

    // Update exchange rates
    setExchangeRates(freshRates);

    const now = Date.now();
    const newPrices: PriceMap = {};

    // ── Crypto: use live price, fall back to cached price, then manualPrice ──
    for (const asset of cryptoAssets) {
      const result = cryptoBatchResult[asset.symbol];
      if (result && result.price > 0) {
        const entry: PriceEntry = {
          price: result.price,
          change24h: result.change24h,
          source: "coingecko",
          status: "live",
          updatedAt: now,
        };
        newPrices[asset.symbol] = entry;
        pricesCacheRef.current[asset.symbol] = entry;
      } else {
        const cached = pricesCacheRef.current[asset.symbol];
        if (cached && cached.price > 0) {
          console.warn(
            `[PriceFeed] Using stale cached price for ${asset.symbol}: $${cached.price}`,
          );
          newPrices[asset.symbol] = {
            ...cached,
            status: "stale",
            updatedAt: now,
          };
        } else if (asset.manualPrice > 0) {
          newPrices[asset.symbol] = {
            price: asset.manualPrice,
            change24h: 0,
            source: "manual",
            status: "error",
            updatedAt: now,
          };
        } else {
          newPrices[asset.symbol] = {
            price: 0,
            change24h: 0,
            source: "manual",
            status: "error",
            updatedAt: now,
          };
        }
      }
    }

    // ── Forex ──
    for (const { asset, result } of forexResults) {
      const key = asset.symbol;
      if (result && result.price > 0) {
        const entry: PriceEntry = {
          price: result.price,
          change24h: result.change24h,
          source: "frankfurter",
          status: "live",
          updatedAt: now,
        };
        newPrices[key] = entry;
        pricesCacheRef.current[key] = entry;
      } else {
        const cached = pricesCacheRef.current[key];
        if (cached && cached.price > 0) {
          newPrices[key] = { ...cached, status: "stale", updatedAt: now };
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
    }

    // ── Stocks ──
    for (const { asset, result } of stockResults) {
      const key = asset.symbol;
      if (result && result.price > 0) {
        const entry: PriceEntry = {
          price: result.price,
          change24h: result.change24h,
          source: "yahoo",
          status: "live",
          updatedAt: now,
        };
        newPrices[key] = entry;
        pricesCacheRef.current[key] = entry;
      } else {
        const cached = pricesCacheRef.current[key];
        if (cached && cached.price > 0) {
          newPrices[key] = { ...cached, status: "stale", updatedAt: now };
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
    }

    // ── Cash ──
    for (const asset of assets.filter((a) => a.category === Category.Cash)) {
      newPrices[asset.symbol] = {
        price: asset.manualPrice,
        change24h: 0,
        source: "manual",
        status: "live",
        updatedAt: now,
      };
    }

    // ── Commodity: Metals (XAU, XAG, XPT, XPD) via Yahoo Finance futures ──
    for (const { asset, result } of metalResults) {
      const key = asset.symbol;
      if (result && result.price > 0) {
        const entry: PriceEntry = {
          price: result.price,
          change24h: result.change24h,
          source: "yahoo",
          status: "live",
          updatedAt: now,
        };
        newPrices[key] = entry;
        pricesCacheRef.current[key] = entry;
      } else {
        // Fallback chain: cached → manualPrice → retry with Yahoo symbol directly
        const cached = pricesCacheRef.current[key];
        if (cached && cached.price > 0) {
          newPrices[key] = { ...cached, status: "stale", updatedAt: now };
        } else if (asset.manualPrice > 0) {
          newPrices[key] = {
            price: asset.manualPrice,
            change24h: 0,
            source: "manual",
            status: "error",
            updatedAt: now,
          };
        } else {
          // Keep price undefined so OverviewPage can use avgCost fallback
          // Don't store a zero-price entry — it would look like the asset has no value
          newPrices[key] = {
            price: 0,
            change24h: 0,
            source: "manual",
            status: "error",
            updatedAt: now,
          };
        }
      }
    }

    // ── Commodity: Oil (CL=F, BZ=F) via Yahoo Finance ──
    for (const { asset, result } of oilResults) {
      const key = asset.symbol;
      if (result && result.price > 0) {
        const entry: PriceEntry = {
          price: result.price,
          change24h: result.change24h,
          source: "yahoo",
          status: "live",
          updatedAt: now,
        };
        newPrices[key] = entry;
        pricesCacheRef.current[key] = entry;
      } else {
        const cached = pricesCacheRef.current[key];
        if (cached && cached.price > 0) {
          newPrices[key] = { ...cached, status: "stale", updatedAt: now };
        } else if (asset.manualPrice > 0) {
          newPrices[key] = {
            price: asset.manualPrice,
            change24h: 0,
            source: "manual",
            status: "error",
            updatedAt: now,
          };
        } else {
          newPrices[key] = {
            price: 0,
            change24h: 0,
            source: "manual",
            status: "error",
            updatedAt: now,
          };
        }
      }
    }

    // ── Real Estate (manual price only) ──
    for (const asset of assets.filter(
      (a) => a.category === Category.RealEstate,
    )) {
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
  }, [assets, actor]);

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
      value={{
        prices,
        isLoading,
        refetch,
        exchangeRates,
        convert,
        onPricesUpdated,
      }}
    >
      {children}
    </PriceFeedContext.Provider>
  );
}

export function usePrices(): PriceFeedContextValue {
  return useContext(PriceFeedContext);
}
