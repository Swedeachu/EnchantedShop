import { MinecraftEntityTypes } from "@minecraft/vanilla-data";
import type { SystemManager } from "../core/SystemManager";
import type { NpcDefinition } from "../core/entities/NpcTypes";
import { GameConfig } from "../config/GameConfig";
import { stationaryBehavior } from "../core/entities/behaviors/StationaryBehavior";
import { triggerEventsOnAttach } from "../core/entities/behaviors/TriggerEventBehavior";
import { openShopOnInteractOrHit } from "./behaviors/OpenShopBehavior";

export const SHOPMAN_NPC_ID = "shopman";

/**
 * Mister ShopMan's definition: a plain `minecraft:villager_v2` (guaranteed
 * to render correctly, no custom entity involved), permanently stationary,
 * forced into the cartographer look for visuals, and wired to open the
 * shop UI. Built here but registered by HubScene (his home), not by
 * SystemManager - see HubScene.init().
 */
export function createShopManNpc(manager: SystemManager): NpcDefinition {
  const { dimensionId, spawnLocation, nameTag, tag } = GameConfig.shopMan;

  return {
    id: SHOPMAN_NPC_ID,
    typeId: MinecraftEntityTypes.VillagerV2,
    tag,
    nameTag,
    dimensionId,
    spawnLocation,
    invincible: true,
    behaviors: [
      stationaryBehavior(spawnLocation),
      // Cosmetic only: forces the real "become_cartographer" vanilla event
      // so he wears the cartographer look without needing a job site block.
      triggerEventsOnAttach("minecraft:become_cartographer"),
      openShopOnInteractOrHit({
        shopSystem: manager.getShopSystem(),
        kitsSystem: manager.getKitsSystem(),
        currencySystem: manager.getCurrencySystem(),
        deliverySystem: manager.getDeliverySystem()
      })
    ]
  };
}
