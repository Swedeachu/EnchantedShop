import { MinecraftItemTypes } from "@minecraft/vanilla-data";
import { KITS_CONFIG } from "../kits/KitsConfig";
import { KIT_CATEGORY_LABEL } from "../kits/KitTypes";
import { ShopEntryKind, type RotatingShopRotation } from "./ShopTypes";

function findKit(id: string) {
  const kit = KITS_CONFIG.find((candidate) => candidate.id === id);
  if (!kit) {
    throw new Error(`RotatingShopConfig references unknown kit id "${id}" - check KITS_CONFIG.`);
  }
  return kit;
}

/**
 * Each entry here is one full, curated snapshot of the limited-time shop.
 * ShopSystem cycles through these in order (wrapping around) every
 * GameConfig.rotatingShop.rotationDurationMinutes, resetting every entry's
 * stock to its configured maxStock on each rotation.
 */
export const ROTATING_SHOP_ROTATIONS: readonly RotatingShopRotation[] = [
  {
    id: "rotation_featured_diamond",
    entries: [
      {
        maxStock: 3,
        entry: {
          kind: ShopEntryKind.Kit,
          id: "kit:pvp_diamond",
          category: KIT_CATEGORY_LABEL[findKit("pvp_diamond").category],
          price: 600, // discounted vs. the static shop's 750 while it's featured
          kit: findKit("pvp_diamond")
        }
      },
      {
        maxStock: 10,
        entry: {
          kind: ShopEntryKind.Item,
          id: "item:totem_of_undying",
          category: "Featured",
          price: 500,
          displayName: "Totem of Undying",
          item: { itemId: MinecraftItemTypes.TotemOfUndying, amount: 1 }
        }
      }
    ]
  },
  {
    id: "rotation_featured_archer",
    entries: [
      {
        maxStock: 5,
        entry: {
          kind: ShopEntryKind.Kit,
          id: "kit:archer_basic",
          category: KIT_CATEGORY_LABEL[findKit("archer_basic").category],
          price: 220, // discounted vs. the static shop's 300 while it's featured
          kit: findKit("archer_basic")
        }
      },
      {
        maxStock: 20,
        entry: {
          kind: ShopEntryKind.Item,
          id: "item:diamond",
          category: "Featured",
          price: 60,
          displayName: "Diamond",
          item: { itemId: MinecraftItemTypes.Diamond, amount: 1 }
        }
      }
    ]
  }
];
