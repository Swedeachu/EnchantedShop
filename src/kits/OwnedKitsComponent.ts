import { createComponentKey, type Serializable } from "../core/components/ComponentContainer";

export type OwnedKitsSnapshot = Readonly<Record<string, number>>;

/**
 * Tracks how many of each kit a player has ever purchased. This is purchase
 * history for future UI/analytics use ("you own this kit") - it never gates
 * a purchase; every buy still delivers its contents directly regardless of
 * how many times the kit was bought before.
 */
export class OwnedKitsComponent implements Serializable<OwnedKitsSnapshot> {
  private readonly counts = new Map<string, number>();

  public constructor(initial?: OwnedKitsSnapshot) {
    if (initial) {
      for (const [kitId, count] of Object.entries(initial)) {
        this.counts.set(kitId, count);
      }
    }
  }

  public getCount(kitId: string): number {
    return this.counts.get(kitId) ?? 0;
  }

  /** Ids of every kit this player owns at least one of - used for logging/UI summaries. */
  public getOwnedKitIds(): string[] {
    return [...this.counts.entries()].filter(([, count]) => count > 0).map(([kitId]) => kitId);
  }

  public recordPurchase(kitId: string, quantity: number): void {
    this.counts.set(kitId, this.getCount(kitId) + quantity);
  }

  public serialize(): OwnedKitsSnapshot {
    return Object.fromEntries(this.counts);
  }

  public static deserialize(value: OwnedKitsSnapshot): OwnedKitsComponent {
    return new OwnedKitsComponent(value);
  }
}

export const OwnedKitsComponentKey = createComponentKey<OwnedKitsComponent>("ownedKits");
