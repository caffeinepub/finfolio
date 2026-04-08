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
import MixinAuthorization "mo:caffeineai-authorization/MixinAuthorization";
import AccessControl "mo:caffeineai-authorization/access-control";
import HttpOutcall "mo:caffeineai-http-outcalls/outcall";

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

  // Stock price result type (Yahoo Finance)
  type StockPrice = {
    symbol : Text;
    price : Float;
    change24h : Float;
    ok : Bool;
  };

  // Stock search result type
  type StockSearchResult = {
    symbol : Text;
    name : Text;
    exchange : Text;
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

  // Transform for HTTP outcalls (strips headers for consensus)
  public query func transform(input : HttpOutcall.TransformationInput) : async HttpOutcall.TransformationOutput {
    HttpOutcall.transform(input);
  };

  // Transform for search HTTP outcalls
  public query func transformSearch(input : HttpOutcall.TransformationInput) : async HttpOutcall.TransformationOutput {
    HttpOutcall.transform(input);
  };

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

  // -------------------------------------------------------
  // Stock price via Yahoo Finance (server-side outcall, works for all markets)
  // -------------------------------------------------------

  // Parse a float from a string like "12345.67" or "-0.5"
  func parseFloatStr(s : Text) : ?Float {
    if (s == "" or s == "-") return null;
    var negative = false;
    var intPart : Int = 0;
    var fracPart : Float = 0.0;
    var fracDiv : Float = 1.0;
    var inFrac = false;
    var hasDigit = false;
    var first = true;
    for (c in s.chars()) {
      if (first and c == '-') {
        negative := true;
        first := false;
      } else if (c == '.' and not inFrac) {
        inFrac := true;
        first := false;
      } else if (c >= '0' and c <= '9') {
        let dNat : Nat = switch (Nat.fromText(Text.fromChar(c))) {
          case (?n) { n };
          case (null) { 0 };
        };
        let d = dNat.toFloat();
        if (inFrac) {
          fracDiv *= 10.0;
          fracPart += d / fracDiv;
        } else {
          intPart := intPart * 10 + Int.fromNat(dNat);
        };
        hasDigit := true;
        first := false;
      } else {
        first := false;
      };
    };
    if (not hasDigit) return null;
    let result = intPart.toFloat() + fracPart;
    if (negative) ?(-result) else ?result;
  };

  // Find the first occurrence of `needle` in `haystack` and return its index
  func textIndexOf(haystack : Text, needle : Text) : ?Nat {
    let hSize = haystack.size();
    let nSize = needle.size();
    if (nSize == 0) return ?0;
    if (nSize > hSize) return null;
    let hChars = haystack.toArray();
    let nChars = needle.toArray();
    var i = 0;
    label outer while (i + nSize <= hSize) {
      var j = 0;
      var match = true;
      while (j < nSize) {
        if (hChars[i + j] != nChars[j]) {
          match := false;
          j := nSize; // break inner
        };
        j += 1;
      };
      if (match) return ?i;
      i += 1;
    };
    null;
  };

  // Extract a float value for `key` from a JSON body
  func extractFloat(json : Text, key : Text) : ?Float {
    let needle = "\"" # key # "\":";
    switch (textIndexOf(json, needle)) {
      case (null) { null };
      case (?idx) {
        let start = idx + needle.size();
        let jsonSize = json.size();
        if (start >= jsonSize) return null;
        var numStr = "";
        var collecting = false;
        var done = false;
        var charPos = 0;
        for (c in json.chars()) {
          if (not done) {
            if (charPos >= start) {
              if (not collecting and (c == ' ' or c == '\t')) {
                charPos += 1;
              } else if ((c >= '0' and c <= '9') or c == '.' or (c == '-' and not collecting)) {
                numStr #= Text.fromChar(c);
                collecting := true;
                charPos += 1;
              } else if (collecting) {
                done := true;
              } else {
                charPos += 1;
              };
            } else {
              charPos += 1;
            };
          };
        };
        parseFloatStr(numStr);
      };
    };
  };

  // Extract a text value for `key` from a JSON body (for string fields like symbol, name, exchange)
  func extractText(json : Text, key : Text) : ?Text {
    let needle = "\"" # key # "\":\"";
    switch (textIndexOf(json, needle)) {
      case (null) { null };
      case (?idx) {
        let start = idx + needle.size();
        let jsonSize = json.size();
        if (start >= jsonSize) return null;
        var result = "";
        var charPos = 0;
        var done = false;
        for (c in json.chars()) {
          if (not done) {
            if (charPos >= start) {
              if (c == '\"') {
                done := true;
              } else {
                result #= Text.fromChar(c);
                charPos += 1;
              };
            } else {
              charPos += 1;
            };
          };
        };
        if (result == "") null else ?result;
      };
    };
  };

  // Convert old-format VN symbol (HOSE:VNM or HNX:SHB) to Yahoo Finance format (VNM.VN)
  func toYahooSymbol(symbol : Text) : Text {
    // Already has exchange suffix (e.g. VNM.VN, 7203.T) -- pass through
    if (symbol.contains(#text ".")) return symbol;
    // Old-format VN symbols (HOSE:VNM or HNX:SHB) -> VNM.VN
    if (symbol.startsWith(#text "HOSE:") or symbol.startsWith(#text "HNX:")) {
      var ticker = "";
      var afterColon = false;
      for (c in symbol.chars()) {
        if (afterColon) {
          ticker #= Text.fromChar(c);
        } else if (c == ':') {
          afterColon := true;
        };
      };
      if (ticker == "") symbol else ticker # ".VN";
    } else {
      // US and other international stocks use symbol as-is (e.g. AAPL, MSFT, TSLA)
      symbol;
    };
  };

  // -------------------------------------------------------
  // Get stock price from Yahoo Finance v8 chart API
  // Response path: chart.result[0].meta.regularMarketPrice
  // -------------------------------------------------------
  public shared func getStockPrice(symbol : Text) : async StockPrice {
    let yahooSymbol = toYahooSymbol(symbol);
    let url = "https://query1.finance.yahoo.com/v8/finance/chart/" # yahooSymbol # "?interval=1d&range=1d";
    try {
      let body = await HttpOutcall.httpGetRequest(
        url,
        [{ name = "Accept"; value = "application/json" }],
        transform,
      );
      // Yahoo Finance v8 response: {"chart":{"result":[{"meta":{"regularMarketPrice":123.45,"regularMarketPreviousClose":120.0,...},...}],...}}
      // extractFloat finds the first occurrence of the key anywhere in the JSON string
      let price = switch (extractFloat(body, "regularMarketPrice")) {
        case (null) { return { symbol; price = 0.0; change24h = 0.0; ok = false } };
        case (?p) { if (p == 0.0) return { symbol; price = 0.0; change24h = 0.0; ok = false }; p };
      };
      // Use regularMarketPreviousClose for 24h change calculation
      let prevClose = switch (extractFloat(body, "regularMarketPreviousClose")) {
        case (null) {
          // Fallback: try chartPreviousClose
          switch (extractFloat(body, "chartPreviousClose")) {
            case (null) { price };
            case (?p) { if (p == 0.0) price else p };
          };
        };
        case (?p) { if (p == 0.0) price else p };
      };
      let change24h = if (prevClose != 0.0) {
        (price - prevClose) / prevClose * 100.0;
      } else { 0.0 };
      { symbol; price; change24h; ok = true };
    } catch (_) {
      { symbol; price = 0.0; change24h = 0.0; ok = false };
    };
  };

  // -------------------------------------------------------
  // Search stocks via Yahoo Finance search API
  // Returns EQUITY type results with symbol, name, exchange
  // -------------------------------------------------------
  public shared func searchStocks(searchTerm : Text) : async [StockSearchResult] {
    let url = "https://query1.finance.yahoo.com/v1/finance/search?q=" # searchTerm # "&quotesCount=10&newsCount=0&enableFuzzyQuery=true&quotesQueryId=tss_match_phrase_query";
    try {
      let body = await HttpOutcall.httpGetRequest(
        url,
        [{ name = "Accept"; value = "application/json" }],
        transformSearch,
      );
      // Parse the quotes array from the response
      // Response shape: {"finance":{"result":[{"quotes":[{"symbol":"AAPL","shortname":"Apple Inc.","exchange":"NMS","quoteType":"EQUITY",...},...]}],...}}
      // We extract each quote object by splitting on "},{"
      parseSearchResults(body);
    } catch (_) {
      [];
    };
  };

  // Parse search results from Yahoo Finance search response
  func parseSearchResults(body : Text) : [StockSearchResult] {
    let results = List.empty<StockSearchResult>();
    // Find the "quotes" array in the JSON
    let quotesNeedle = "\"quotes\":[";
    switch (textIndexOf(body, quotesNeedle)) {
      case (null) { return [] };
      case (?quotesIdx) {
        let arrayStart = quotesIdx + quotesNeedle.size();
        let bodySize = body.size();
        if (arrayStart >= bodySize) return [];
        // Extract the substring from the start of the quotes array
        let bodyChars = body.toArray();
        // Find the end of the quotes array by counting brackets
        var depth = 1;
        var i = arrayStart;
        var arrayContent = "";
        while (i < bodySize and depth > 0) {
          let c = bodyChars[i];
          if (c == '[') {
            depth += 1;
            arrayContent #= Text.fromChar(c);
          } else if (c == ']') {
            depth -= 1;
            if (depth > 0) {
              arrayContent #= Text.fromChar(c);
            };
          } else {
            arrayContent #= Text.fromChar(c);
          };
          i += 1;
        };
        // arrayContent now contains the JSON objects in the quotes array (without outer brackets)
        // Split individual quote objects — each starts with "{" and ends with "}"
        // We extract each object by tracking brace depth
        let contentChars = arrayContent.toArray();
        let contentSize = arrayContent.size();
        var objStart = 0;
        var objDepth = 0;
        var inObj = false;
        var k = 0;
        while (k < contentSize) {
          let c = contentChars[k];
          if (c == '{') {
            if (not inObj) {
              objStart := k;
              inObj := true;
            };
            objDepth += 1;
          } else if (c == '}') {
            if (inObj) {
              objDepth -= 1;
              if (objDepth == 0) {
                // Extract object from objStart to k (inclusive)
                var obj = "";
                var m = objStart;
                while (m <= k) {
                  obj #= Text.fromChar(contentChars[m]);
                  m += 1;
                };
                inObj := false;
                // Parse this object: check quoteType == "EQUITY"
                let quoteType = switch (extractText(obj, "quoteType")) {
                  case (null) { "" };
                  case (?t) { t };
                };
                if (quoteType == "EQUITY") {
                  let sym = switch (extractText(obj, "symbol")) {
                    case (null) { "" };
                    case (?s) { s };
                  };
                  let name = switch (extractText(obj, "shortname")) {
                    case (null) {
                      switch (extractText(obj, "longname")) {
                        case (null) { sym };
                        case (?n) { n };
                      };
                    };
                    case (?n) { n };
                  };
                  let exchange = switch (extractText(obj, "exchange")) {
                    case (null) { "" };
                    case (?e) { e };
                  };
                  if (sym != "") {
                    results.add({ symbol = sym; name; exchange });
                  };
                };
              };
            };
          };
          k += 1;
        };
      };
    };
    results.toArray();
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

  // Internal holdings calculation (reusable without authorization check)
  func calcHoldings(caller : Principal) : [Holding] {
    let userAssets = getCallerAssets(caller).values().toArray();
    let userTxs = getCallerTransactions(caller).values().toArray();
    let holdings = List.empty<Holding>();

    for (asset in userAssets.values()) {
      let assetTxs = userTxs.filter(func(tx) { tx.assetId == asset.id });
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

      let averageCost = if (buyQuantity > 0.0) { totalBuys / buyQuantity } else { 0.0 };
      let currentValue = totalQuantity * asset.manualPrice;
      let gainLoss = currentValue - totalCost;
      let gainLossPercent = if (totalCost > 0.0) { gainLoss / totalCost * 100.0 } else { 0.0 };

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
  public query ({ caller }) func getPortfolioSummary() : async PortfolioSummary {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view portfolio summary");
    };
    let holdings = calcHoldings(caller);
    var totalValue = 0.0;
    var totalCost = 0.0;

    for (holding in holdings.values()) {
      totalValue += holding.totalValue;
      totalCost += holding.totalCost;
    };

    let gainLoss = totalValue - totalCost;
    let gainLossPercent = if (totalCost > 0.0) { gainLoss / totalCost * 100.0 } else { 0.0 };

    // Build allocation map using a Map to aggregate by category
    let allocationMap = Map.empty<Text, { value : Float; category : Asset.Category }>();

    for (holding in holdings.values()) {
      let catKey = switch (holding.category) {
        case (#Stock) { "Stock" };
        case (#Crypto) { "Crypto" };
        case (#Forex) { "Forex" };
        case (#Cash) { "Cash" };
      };
      switch (allocationMap.get(catKey)) {
        case (null) {
          allocationMap.add(catKey, { value = holding.totalValue; category = holding.category });
        };
        case (?existing) {
          allocationMap.add(catKey, { value = existing.value + holding.totalValue; category = holding.category });
        };
      };
    };

    let allocation = allocationMap.values().toArray().map(
      func(entry) {
        {
          category = entry.category;
          value = entry.value;
          percentage = if (totalValue > 0.0) { entry.value / totalValue * 100.0 } else { 0.0 };
        };
      }
    );

    {
      totalValue;
      totalCost;
      totalGainLoss = gainLoss;
      totalGainLossPercent = gainLossPercent;
      dailyChange = 0.0;
      allocation;
    };
  };
};
