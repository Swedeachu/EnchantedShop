import { MinecraftEntityTypes } from "@minecraft/vanilla-data";
import type { SystemManager } from "../core/SystemManager";
import type { NpcDefinition } from "../core/entities/NpcTypes";
import { GameConfig } from "../config/GameConfig";
import { stationaryBehavior } from "../core/entities/behaviors/StationaryBehavior";
import { triggerEventsOnAttach } from "../core/entities/behaviors/TriggerEventBehavior";
import { openShopOnInteractOrHit } from "./behaviors/OpenShopBehavior";

export const SHOPMAN_NPC_ID = "shopman";

/**
 * Mister ShopMan spawns as a plain `minecraft:villager_v2` - guaranteed to
 * render correctly, no custom entity involved.
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
      // Purely cosmetic: the real "minecraft:become_cartographer" vanilla
      // event, forced without a job site block, so he permanently wears
      // the cartographer's robe/badge look 
      //  - this event's component groups set his profession
      // variant; the "work_schedule"/"make_and_receive_love" groups it also
      // adds are harmless here: he's the only villager around to breed
      // with, and there's no night to sleep through since time is locked
      // at noon - and stationaryBehavior's teleport-back still overrides
      // any wandering it might otherwise cause anyway).
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
