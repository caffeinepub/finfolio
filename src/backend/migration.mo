import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Float "mo:core/Float";
import Text "mo:core/Text";
import Principal "mo:core/Principal";

module {
  // Old Transaction type (before currency field was added)
  type TxType = {
    #Buy;
    #Sell;
    #Deposit;
    #Withdraw;
  };

  type OldTransaction = {
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

  type NewTransaction = {
    id : Nat;
    assetId : Nat;
    txType : TxType;
    quantity : Float;
    price : Float;
    currency : Text;
    fee : Float;
    date : Int;
    note : Text;
    createdAt : Int;
  };

  type OldActor = {
    transactions : Map.Map<Principal, Map.Map<Nat, OldTransaction>>;
  };

  type NewActor = {
    transactions : Map.Map<Principal, Map.Map<Nat, NewTransaction>>;
  };

  public func run(old : OldActor) : NewActor {
    // Migrate transactions: add currency = "" (will be resolved at runtime to asset currency)
    let newTransactions = old.transactions.map<Principal, Map.Map<Nat, OldTransaction>, Map.Map<Nat, NewTransaction>>(
      func(_principal, userTxs) {
        userTxs.map<Nat, OldTransaction, NewTransaction>(
          func(_id, tx) {
            { tx with currency = "" }
          }
        )
      }
    );
    { transactions = newTransactions }
  };
};
