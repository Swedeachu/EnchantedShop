import { createComponentKey, type Serializable } from "../core/components/ComponentContainer";
import { registerPlayerComponent } from "../core/components/ComponentRegistry";
import { GameConfig } from "../config/GameConfig";

export class CurrencyComponent implements Serializable<number> {
  private balance: number;

  public constructor(startingBalance = 0) {
    this.balance = Math.max(0, Math.floor(startingBalance));
  }

  public getBalance(): number {
    return this.balance;
  }

  public canAfford(amount: number): boolean {
    return amount >= 0 && this.balance >= amount;
  }

  public add(amount: number): void {
    if (amount < 0) {
      throw new Error("CurrencyComponent.add() cannot take a negative amount - use remove().");
    }
    this.balance += Math.floor(amount);
  }

  /** Returns false (and changes nothing) if the balance would go negative. */
  public remove(amount: number): boolean {
    if (amount < 0) {
      throw new Error("CurrencyComponent.remove() cannot take a negative amount - use add().");
    }
    if (!this.canAfford(amount)) {
      return false;
    }
    this.balance -= Math.floor(amount);
    return true;
  }

  public serialize(): number {
    return this.balance;
  }

  public static deserialize(value: number): CurrencyComponent {
    return new CurrencyComponent(value);
  }
}

export const CurrencyComponentKey = createComponentKey<CurrencyComponent>("currency");
export const CURRENCY_DYNAMIC_PROPERTY_KEY = "enchantedshop:currency";

// Self-registers with PlayerSystem (see ComponentRegistry.ts) 
// - no System has to read/deserialize/persist this component by hand.
registerPlayerComponent<CurrencyComponent, number>({
  key: CurrencyComponentKey,
  dynamicPropertyKey: CURRENCY_DYNAMIC_PROPERTY_KEY,
  defaultSnapshot: GameConfig.currency.startingBalance,
  deserialize: CurrencyComponent.deserialize
});
