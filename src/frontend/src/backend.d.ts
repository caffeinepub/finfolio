import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
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
export interface Public {
    baseCurrency: string;
    displayName: string;
    createdAt: bigint;
    user: Principal;
}
export interface Transaction {
    id: bigint;
    fee: number;
    assetId: bigint;
    date: bigint;
    note: string;
    createdAt: bigint;
    quantity: number;
    txType: TxType;
    price: number;
}
export enum Category {
    Stock = "Stock",
    Cash = "Cash",
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
    addTransaction(tx: Transaction): Promise<bigint>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    deleteAsset(id: bigint): Promise<void>;
    deleteTransaction(id: bigint): Promise<void>;
    getAsset(id: bigint): Promise<Public__1 | null>;
    getAssets(): Promise<Array<Public__1>>;
    getCallerUserProfile(): Promise<Public | null>;
    getCallerUserRole(): Promise<UserRole>;
    getHoldings(): Promise<Array<Holding>>;
    getPortfolioSummary(): Promise<PortfolioSummary>;
    getProfile(): Promise<Public | null>;
    getSnapshots(startDate: bigint, endDate: bigint): Promise<Array<PortfolioSnapshot>>;
    getTransaction(id: bigint): Promise<Transaction | null>;
    getTransactions(): Promise<Array<Transaction>>;
    getUserProfile(user: Principal): Promise<Public | null>;
    isCallerAdmin(): Promise<boolean>;
    saveCallerUserProfile(profile: Public): Promise<void>;
    updateAsset(asset: Public__1): Promise<void>;
    updateProfile(profile: Public): Promise<void>;
    updateTransaction(tx: Transaction): Promise<void>;
}
