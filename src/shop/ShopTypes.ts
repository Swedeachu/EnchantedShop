import type { KitDefinition } from "../kits/KitTypes";
import type { ItemDefinition } from "../items/ItemFactory";

export enum ShopEntryKind {
  Item = "item",
  Kit = "kit"
}

interface ShopEntryBase {
  /** Unique within the shop(s) it appears in - also the dynamic-property key used for rotating-shop stock. */
  readonly id: string;
  /** Free-form label the entry is grouped under in the category menu. */
  readonly category: string;
  readonly price: number;
}

export interface ShopItemEntry extends ShopEntryBase {
  readonly kind: ShopEntryKind.Item;
  readonly displayName: string;
  readonly item: ItemDefinition;
}

export interface ShopKitEntry extends ShopEntryBase {
  readonly kind: ShopEntryKind.Kit;
  readonly kit: KitDefinition;
}

/** Either a generic item or a kit - the shop supports selling both side by side. */
export type ShopEntry = ShopItemEntry | ShopKitEntry;

export interface RotatingShopEntry {
  readonly entry: ShopEntry;
  /** Stock resets to this value every time this rotation becomes active. */
  readonly maxStock: number;
}

/** One curated, fully self-contained snapshot of the limited-time shop's contents. */
export interface RotatingShopRotation {
  readonly id: string;
  readonly entries: readonly RotatingShopEntry[];
  /** Overrides GameConfig.rotatingShop.rotationDurationMinutes for how long *this* rotation stays active, if set. */
  readonly durationMinutesOverride?: number;
}
