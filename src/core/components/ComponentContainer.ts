/**
 * A tiny, typed component bag - the foundation of the data-component ("ECS
 * lite") pattern used for per-player state: currency balance, owned kits,
 * cooldowns, etc. Each component is registered under a unique symbol key
 * that carries its value's type, so `get`/`set`/`require` stay type-safe
 * without a central switch statement. A GamePlayer's own container gets
 * populated automatically by self-registration - see ComponentRegistry.ts.
 *
 * Usage:
 *   const CurrencyKey = createComponentKey<CurrencyComponent>("currency");
 *   gamePlayer.components.set(CurrencyKey, new CurrencyComponent(500));
 *   const currency = gamePlayer.components.require(CurrencyKey);
 */

/** A key that "remembers" the type `T` it was created for, purely for compile-time inference. */
export type ComponentKey<T> = symbol & { readonly __componentType?: T };

export function createComponentKey<T>(description: string): ComponentKey<T> {
  return Symbol(description) as ComponentKey<T>;
}

/** Implemented by components that can be flattened for storage in dynamic properties. */
export interface Serializable<TSerialized = unknown> {
  serialize(): TSerialized;
}

export class ComponentContainer {
  private readonly values = new Map<symbol, unknown>();

  public set<T>(key: ComponentKey<T>, value: T): void {
    this.values.set(key, value);
  }

  public get<T>(key: ComponentKey<T>): T | undefined {
    return this.values.get(key) as T | undefined;
  }

  /** Like `get`, but throws instead of returning `undefined`. Use once a component is guaranteed to exist. */
  public require<T>(key: ComponentKey<T>): T {
    const value = this.get(key);
    if (value === undefined) {
      throw new Error(`Missing required component: ${String(key)}`);
    }
    return value;
  }

  public has<T>(key: ComponentKey<T>): boolean {
    return this.values.has(key);
  }

  public delete<T>(key: ComponentKey<T>): boolean {
    return this.values.delete(key);
  }

  public [Symbol.iterator](): IterableIterator<[symbol, unknown]> {
    return this.values.entries();
  }
}
