import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Public__2 {
    id: bigint;
    totalValue: number;
    date: bigint;
    createdAt: bigint;
}
export interface TransformationOutput {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface TransactionImport {
    fee: number;
    assetId: bigint;
    date: bigint;
    note: string;
    currency: string;
    quantity: number;
    txType: TxType;
    price: number;
}
export interface PortfolioImportInput {
    assets: Array<AssetImport>;
    transactions: Array<TransactionImport>;
}
export interface PortfolioSummary {
    totalValue: number;
    totalCost: number;
    dailyChange: number;
    totalGainLoss: number;
    allocation: Array<{
        value: number;
        category: Category;
        percentage: number;
    }>;
    totalGainLossPercent: number;
}
export interface StockSearchResult {
    name: string;
    exchange: string;
    symbol: string;
}
export interface Public__3 {
    id: bigint;
    fee: number;
    assetId: bigint;
    date: bigint;
    note: string;
    createdAt: bigint;
    currency: string;
    quantity: number;
    txType: TxType;
    price: number;
}
export interface Public {
    baseCurrency: string;
    displayName: string;
    createdAt: bigint;
    user: Principal;
}
export interface PortfolioExport {
    assets: Array<Public__1>;
    snapshots: Array<Public__2>;
    exportedAt: bigint;
    transactions: Array<Public__3>;
    profile?: Public;
}
export interface MetalPrice {
    currency: string;
    timestamp: bigint;
    price: number;
}
export interface http_header {
    value: string;
    name: string;
}
export interface Transaction {
    id: bigint;
    fee: number;
    assetId: bigint;
    date: bigint;
    note: string;
    createdAt: bigint;
    currency: string;
    quantity: number;
    txType: TxType;
    price: number;
}
export interface http_request_result {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface ImportResult {
    assetsSkipped: bigint;
    assetsImported: bigint;
    transactionsImported: bigint;
}
export interface StockPrice {
    ok: boolean;
    change24h: number;
    price: number;
    symbol: string;
}
export interface Holding {
    currentPrice: number;
    assetId: bigint;
    totalValue: number;
    name: string;
    gainLoss: number;
    totalCost: number;
    averageCost: number;
    currency: string;
    quantity: number;
    category: Category;
    gainLossPercent: number;
    symbol: string;
}
export interface PortfolioSnapshot {
    id: bigint;
    totalValue: number;
    date: bigint;
    createdAt: bigint;
}
export interface Public__1 {
    id: bigint;
    name: string;
    note: string;
    createdAt: bigint;
    currency: string;
    category: Category;
    manualPrice: number;
    symbol: string;
}
export interface TransformationInput {
    context: Uint8Array;
    response: http_request_result;
}
export interface AddTransactionInput {
    id: bigint;
    fee: number;
    assetId: bigint;
    date: bigint;
    note: string;
    createdAt: bigint;
    currency: string;
    quantity: number;
    txType: TxType;
    price: number;
}
export interface AssetImport {
    name: string;
    note: string;
    currency: string;
    category: Category;
    manualPrice: number;
    symbol: string;
}
export enum Category {
    Stock = "Stock",
    RealEstate = "RealEstate",
    Cash = "Cash",
    Commodity = "Commodity",
    Forex = "Forex",
    Crypto = "Crypto"
}
export enum TxType {
    Buy = "Buy",
    Withdraw = "Withdraw",
    Deposit = "Deposit",
    Sell = "Sell"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    addAsset(asset: Public__1): Promise<bigint>;
    addSnapshot(snapshot: PortfolioSnapshot): Promise<bigint>;
    addTransaction(tx: AddTransactionInput): Promise<bigint>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    deleteAsset(id: bigint): Promise<void>;
    deleteTransaction(id: bigint): Promise<void>;
    exportPortfolioData(): Promise<PortfolioExport>;
    getAsset(id: bigint): Promise<Public__1 | null>;
    getAssets(): Promise<Array<Public__1>>;
    getCallerUserProfile(): Promise<Public | null>;
    getCallerUserRole(): Promise<UserRole>;
    getExchangeRates(): Promise<Array<[string, number]>>;
    getHoldings(): Promise<Array<Holding>>;
    getHoldingsInCurrency(targetCurrency: string): Promise<Array<Holding>>;
    getMetalPrice(): Promise<MetalPrice>;
    getMetalPriceBySymbol(symbol: string): Promise<MetalPrice>;
    getPortfolioSummary(): Promise<PortfolioSummary>;
    getPortfolioSummaryInCurrency(targetCurrency: string): Promise<PortfolioSummary>;
    getProfile(): Promise<Public | null>;
    getSnapshots(startDate: bigint, endDate: bigint): Promise<Array<PortfolioSnapshot>>;
    getStockPrice(symbol: string): Promise<StockPrice>;
    getTransaction(id: bigint): Promise<Transaction | null>;
    getTransactions(): Promise<Array<Transaction>>;
    getUserProfile(user: Principal): Promise<Public | null>;
    importPortfolioData(data: PortfolioImportInput): Promise<ImportResult>;
    isCallerAdmin(): Promise<boolean>;
    saveCallerUserProfile(profile: Public): Promise<void>;
    searchStocks(searchTerm: string): Promise<Array<StockSearchResult>>;
    transform(input: TransformationInput): Promise<TransformationOutput>;
    transformMetal(input: TransformationInput): Promise<TransformationOutput>;
    transformSearch(input: TransformationInput): Promise<TransformationOutput>;
    updateAsset(asset: Public__1): Promise<void>;
    updateProfile(profile: Public): Promise<void>;
    updateTransaction(tx: AddTransactionInput): Promise<void>;
}
