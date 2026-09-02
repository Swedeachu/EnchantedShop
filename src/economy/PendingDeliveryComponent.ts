import type { ItemDefinition } from "../items/ItemFactory";
import { createComponentKey, type Serializable } from "../core/components/ComponentContainer";

export type PendingDeliverySnapshot = readonly ItemDefinition[];

/**
 * Items that couldn't fit in a player's inventory at purchase (or retry)
 * time. Never dropped on the ground - queued here and flushed back into
 * the inventory as soon as space frees up (see DeliverySystem).
 */
export class PendingDeliveryComponent implements Serializable<PendingDeliverySnapshot> {
  private queue: ItemDefinition[];

  public constructor(initial: PendingDeliverySnapshot = []) {
    this.queue = [...initial];
  }

  public isEmpty(): boolean {
    return this.queue.length === 0;
  }

  public enqueue(definitions: readonly ItemDefinition[]): void {
    this.queue.push(...definitions);
  }

  /** Removes and returns everything currently queued. */
  public drain(): ItemDefinition[] {
    const drained = this.queue;
    this.queue = [];
    return drained;
  }

  /** Puts items back at the front of the queue (e.g. a retry that still didn't fully fit). */
  public requeueFront(definitions: readonly ItemDefinition[]): void {
    this.queue.unshift(...definitions);
  }

  public serialize(): PendingDeliverySnapshot {
    return this.queue;
  }

  public static deserialize(value: PendingDeliverySnapshot): PendingDeliveryComponent {
    return new PendingDeliveryComponent(value);
  }
}

export const PendingDeliveryComponentKey = createComponentKey<PendingDeliveryComponent>("pendingDelivery");
