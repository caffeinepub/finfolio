import Map "mo:core/Map";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Float "mo:core/Float";
import Text "mo:core/Text";
import Order "mo:core/Order";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";
import Iter "mo:core/Iter";
import List "mo:core/List";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

actor {
  // Types
  module Asset {
    public type Category = {
      #Stock;
      #Crypto;
      #Forex;
      #Cash;
    };
    public type Public = {
      id : Nat;
      symbol : Text;
      name : Text;
      category : Category;
      currency : Text;
      manualPrice : Float;
      note : Text;
      createdAt : Int;
    };
    public func compare(a1 : Public, a2 : Public) : Order.Order {
      Nat.compare(a1.id, a2.id);
    };
  };

  module Transaction {
    public type TxType = {
      #Buy;
      #Sell;
      #Deposit;
      #Withdraw;
    };
    public type Public = {
      id : Nat;
      assetId : Nat;
      txType : TxType;
      quantity : Float;
      price : Float;
      fee : Float;
      date : Int;
      note : Text;
      createdAt : Int;
    };
    public func compare(t1 : Public, t2 : Public) : Order.Order {
      Nat.compare(t1.id, t2.id);
    };
  };

  module PortfolioSnapshot {
    public type Public = {
      id : Nat;
      totalValue : Float;
      date : Int;
      createdAt : Int;
    };
    public func compare(s1 : Public, s2 : Public) : Order.Order {
      Nat.compare(s1.id, s2.id);
    };
  };

  module UserProfile {
    public type Public = {
      user : Principal;
      displayName : Text;
      baseCurrency : Text;
      createdAt : Int;
    };
    public func compare(p1 : Public, p2 : Public) : Order.Order {
      Principal.compare(p1.user, p2.user);
    };
  };

  module Holding {
    public func compare(h1 : {
      assetId : Nat;
      symbol : Text;
    }, h2 : {
      assetId : Nat;
      symbol : Text;
    }) : Order.Order {
      Nat.compare(h1.assetId, h2.assetId);
    };
  };

  module PortfolioSummary {
    public func compare(s1 : { totalValue : Float }, s2 : { totalValue : Float }) : Order.Order {
      Float.compare(s1.totalValue, s2.totalValue);
    };
  };

  type Transaction = Transaction.Public;
  type PortfolioSnapshot = PortfolioSnapshot.Public;
  type Holding = {
    assetId : Nat;
    symbol : Text;
    name : Text;
    category : Asset.Category;
    currency : Text;
    quantity : Float;
    averageCost : Float;
    currentPrice : Float;
    totalValue : Float;
    totalCost : Float;
    gainLoss : Float;
    gainLossPercent : Float;
  };
  type PortfolioSummary = {
    totalValue : Float;
    totalCost : Float;
    totalGainLoss : Float;
    totalGainLossPercent : Float;
    dailyChange : Float;
    allocation : [
      {
        category : Asset.Category;
        value : Float;
        percentage : Float;
      }
    ];
  };

  // State
  let assets = Map.empty<Principal, Map.Map<Nat, Asset.Public>>();
  let transactions = Map.empty<Principal, Map.Map<Nat, Transaction>>();
  let snapshots = Map.empty<Principal, Map.Map<Nat, PortfolioSnapshot>>();
  let userProfiles = Map.empty<Principal, UserProfile.Public>();
  var nextAssetId = 1;
  var nextTransactionId = 1;
  var nextSnapshotId = 1;

  // Authorization
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // Helper functions
  func getCallerAssets(caller : Principal) : Map.Map<Nat, Asset.Public> {
    switch (assets.get(caller)) {
      case (?userAssets) { userAssets };
      case (null) {
        let newAssets = Map.empty<Nat, Asset.Public>();
        assets.add(caller, newAssets);
        newAssets;
      };
    };
  };

  func getCallerTransactions(caller : Principal) : Map.Map<Nat, Transaction> {
    switch (transactions.get(caller)) {
      case (?userTxs) { userTxs };
      case (null) {
        let newTxs = Map.empty<Nat, Transaction>();
        transactions.add(caller, newTxs);
        newTxs;
      };
    };
  };

  func getCallerSnapshots(caller : Principal) : Map.Map<Nat, PortfolioSnapshot> {
    switch (snapshots.get(caller)) {
      case (?userSnaps) { userSnaps };
      case (null) {
        let newSnaps = Map.empty<Nat, PortfolioSnapshot>();
        snapshots.add(caller, newSnaps);
        newSnaps;
      };
    };
  };

  // Asset CRUD
  public shared ({ caller }) func addAsset(asset : Asset.Public) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can add assets");
    };
    let id = nextAssetId;
    nextAssetId += 1;
    let newAsset : Asset.Public = {
      asset with
      id;
      createdAt = Time.now();
    };
    let userAssets = getCallerAssets(caller);
    userAssets.add(id, newAsset);
    assets.add(caller, userAssets);
    id;
  };

  public query ({ caller }) func getAssets() : async [Asset.Public] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view assets");
    };
    getCallerAssets(caller).values().toArray().sort();
  };

  public query ({ caller }) func getAsset(id : Nat) : async ?Asset.Public {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view assets");
    };
    getCallerAssets(caller).get(id);
  };

  public shared ({ caller }) func updateAsset(asset : Asset.Public) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update assets");
    };
    let userAssets = getCallerAssets(caller);
    if (not userAssets.containsKey(asset.id)) {
      Runtime.trap("Asset not found");
    };
    userAssets.add(asset.id, asset);
    assets.add(caller, userAssets);
  };

  public shared ({ caller }) func deleteAsset(id : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete assets");
    };
    let userAssets = getCallerAssets(caller);
    if (not userAssets.containsKey(id)) {
      Runtime.trap("Asset not found");
    };
    userAssets.remove(id);
    assets.add(caller, userAssets);
  };

  // Transaction CRUD
  public shared ({ caller }) func addTransaction(tx : Transaction) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can add transactions");
    };
    let id = nextTransactionId;
    nextTransactionId += 1;
    let newTx : Transaction = {
      tx with
      id;
      createdAt = Time.now();
    };
    let userTxs = getCallerTransactions(caller);
    userTxs.add(id, newTx);
    transactions.add(caller, userTxs);
    id;
  };

  public query ({ caller }) func getTransactions() : async [Transaction] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view transactions");
    };
    getCallerTransactions(caller).values().toArray().sort();
  };

  public query ({ caller }) func getTransaction(id : Nat) : async ?Transaction {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view transactions");
    };
    getCallerTransactions(caller).get(id);
  };

  public shared ({ caller }) func updateTransaction(tx : Transaction) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update transactions");
    };
    let userTxs = getCallerTransactions(caller);
    if (not userTxs.containsKey(tx.id)) {
      Runtime.trap("Transaction not found");
    };
    userTxs.add(tx.id, tx);
    transactions.add(caller, userTxs);
  };

  public shared ({ caller }) func deleteTransaction(id : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete transactions");
    };
    let userTxs = getCallerTransactions(caller);
    if (not userTxs.containsKey(id)) {
      Runtime.trap("Transaction not found");
    };
    userTxs.remove(id);
    transactions.add(caller, userTxs);
  };

  // Portfolio Snapshots
  public shared ({ caller }) func addSnapshot(snapshot : PortfolioSnapshot) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can add snapshots");
    };
    let id = nextSnapshotId;
    nextSnapshotId += 1;
    let newSnapshot : PortfolioSnapshot = {
      snapshot with
      id;
      createdAt = Time.now();
    };
    let userSnaps = getCallerSnapshots(caller);
    userSnaps.add(id, newSnapshot);
    snapshots.add(caller, userSnaps);
    id;
  };

  public query ({ caller }) func getSnapshots(startDate : Int, endDate : Int) : async [PortfolioSnapshot] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view snapshots");
    };
    getCallerSnapshots(caller).values().toArray().filter(
      func(s) {
        s.date >= startDate and s.date <= endDate
      }
    ).sort();
  };

  // User Profile - Required interface
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile.Public {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile.Public {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile.Public) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    let newProfile : UserProfile.Public = {
      profile with
      user = caller;
      createdAt = Time.now();
    };
    userProfiles.add(caller, newProfile);
  };

  // Legacy profile functions (kept for backward compatibility)
  public shared ({ caller }) func updateProfile(profile : UserProfile.Public) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update profiles");
    };
    let newProfile : UserProfile.Public = {
      profile with
      user = caller;
      createdAt = Time.now();
    };
    userProfiles.add(caller, newProfile);
  };

  public query ({ caller }) func getProfile() : async ?UserProfile.Public {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
    userProfiles.get(caller);
  };

  // Holdings Calculation
  public query ({ caller }) func getHoldings() : async [Holding] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view holdings");
    };
    let userAssets = getCallerAssets(caller).values().toArray();
    let userTxs = getCallerTransactions(caller).values().toArray();
    let holdings = List.empty<Holding>();

    for (asset in userAssets.values()) {
      let assetTxs = userTxs.filter(
        func(tx) {
          tx.assetId == asset.id;
        }
      );
      var totalQuantity = 0.0;
      var totalCost = 0.0;
      var totalBuys = 0.0;
      var buyQuantity = 0.0;

      for (tx in assetTxs.values()) {
        switch (tx.txType) {
          case (#Buy) {
            totalQuantity += tx.quantity;
            totalCost += tx.quantity * tx.price + tx.fee;
            totalBuys += tx.quantity * tx.price + tx.fee;
            buyQuantity += tx.quantity;
          };
          case (#Sell) {
            totalQuantity -= tx.quantity;
          };
          case (_) {};
        };
      };

      let averageCost = if (buyQuantity > 0.0) {
        totalBuys / buyQuantity;
      } else { 0.0 };
      let currentValue = totalQuantity * asset.manualPrice;
      let gainLoss = currentValue - totalCost;
      let gainLossPercent = if (totalCost > 0.0) { gainLoss / totalCost * 100.0 } else {
        0.0;
      };

      holdings.add({
        assetId = asset.id;
        symbol = asset.symbol;
        name = asset.name;
        category = asset.category;
        currency = asset.currency;
        quantity = totalQuantity;
        averageCost;
        currentPrice = asset.manualPrice;
        totalValue = currentValue;
        totalCost;
        gainLoss;
        gainLossPercent;
      });
    };

    holdings.toArray();
  };

  // Portfolio Summary
  public shared ({ caller }) func getPortfolioSummary() : async PortfolioSummary {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view portfolio summary");
    };
    let holdings = await getHoldings();
    var totalValue = 0.0;
    var totalCost = 0.0;
    var dailyChange = 0.0;

    for (holding in holdings.values()) {
      totalValue += holding.totalValue;
      totalCost += holding.totalCost;
    };

    let gainLoss = totalValue - totalCost;
    let gainLossPercent = if (totalCost > 0.0) { gainLoss / totalCost * 100.0 } else {
      0.0;
    };

    let allocation = List.empty<{ category : Asset.Category; value : Float; percentage : Float }>();

    for (holding in holdings.values()) {
      let cat = holding.category;
      let existing = allocation.filter(
        func(a) {
          a.category == cat;
        }
      );

      if (existing.isEmpty()) {
        allocation.add({
          category = cat;
          value = holding.totalValue;
          percentage = if (totalValue > 0.0) {
            holding.totalValue / totalValue * 100.0;
          } else { 0.0 };
        });
      } else {
        let updated = List.empty<{ category : Asset.Category; value : Float; percentage : Float }>();
        for (a in allocation.values()) {
          if (a.category == cat) {
            updated.add({
              category = cat;
              value = a.value + holding.totalValue;
              percentage = if (totalValue > 0.0) {
                (a.value + holding.totalValue) / totalValue * 100.0;
              } else { 0.0 };
            });
          } else {
            updated.add(a);
          };
        };
        for (u in updated.values()) {
          allocation.add(u);
        };
      };
    };

    {
      totalValue;
      totalCost;
      totalGainLoss = gainLoss;
      totalGainLossPercent = gainLossPercent;
      dailyChange;
      allocation = allocation.toArray();
    };
  };
};
