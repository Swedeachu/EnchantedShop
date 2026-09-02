import { MinecraftItemTypes } from "@minecraft/vanilla-data";
import { KITS_CONFIG } from "../kits/KitsConfig";
import { KIT_CATEGORY_LABEL } from "../kits/KitTypes";
import { ShopEntryKind, type ShopEntry } from "./ShopTypes";

function kitEntries(): ShopEntry[] {
  return KITS_CONFIG.map((kit) => ({
    kind: ShopEntryKind.Kit,
    id: `kit:${kit.id}`,
    category: KIT_CATEGORY_LABEL[kit.category],
    price: kit.price,
    kit
  }));
}

const GENERIC_ITEM_ENTRIES: readonly ShopEntry[] = [
  {
    kind: ShopEntryKind.Item,
    id: "item:golden_apple",
    category: "Food",
    price: 15,
    displayName: "Golden Apple",
    item: { itemId: MinecraftItemTypes.GoldenApple, amount: 1 }
  },
  {
    kind: ShopEntryKind.Item,
    id: "item:cooked_beef",
    category: "Food",
    price: 5,
    displayName: "Cooked Steak",
    item: { itemId: MinecraftItemTypes.CookedBeef, amount: 1 }
  },
  {
    kind: ShopEntryKind.Item,
    id: "item:ender_pearl",
    category: "Utility",
    price: 40,
    displayName: "Ender Pearl",
    item: { itemId: MinecraftItemTypes.EnderPearl, amount: 1 }
  },
  {
    kind: ShopEntryKind.Item,
    id: "item:arrow",
    category: "Utility",
    price: 2,
    displayName: "Arrow",
    item: { itemId: MinecraftItemTypes.Arrow, amount: 1 }
  }
];

/**
 * The always-available shop. Kits load in automatically from KITS_CONFIG
 * (one entry per kit, grouped by its category) alongside a small hand-picked
 * set of generic items - both script-side config, nothing here is persisted.
 */
export const STATIC_SHOP_ENTRIES: readonly ShopEntry[] = [...kitEntries(), ...GENERIC_ITEM_ENTRIES];
