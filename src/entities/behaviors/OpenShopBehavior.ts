import type { Player } from "@minecraft/server";
import type { NpcBehavior, SpawnedNpc } from "../../core/entities/NpcTypes";
import { openShopMenu } from "../../ui/ShopUI";
import type { ShopSystem } from "../../systems/ShopSystem";
import type { KitsSystem } from "../../systems/KitsSystem";
import type { CurrencySystem } from "../../systems/CurrencySystem";
import type { DeliverySystem } from "../../systems/DeliverySystem";

export interface OpenShopBehaviorDeps {
  shopSystem: ShopSystem;
  kitsSystem: KitsSystem;
  currencySystem: CurrencySystem;
  deliverySystem: DeliverySystem;
}

/** Opens the shop UI for whichever player interacts with (right-clicks) OR hits (punches) this NPC. */
export function openShopOnInteractOrHit(deps: OpenShopBehaviorDeps): NpcBehavior {
  const open = (player: Player, _npc: SpawnedNpc): void => {
    void openShopMenu(player, deps);
  };

  return {
    onInteract: open,
    onHit: open
  };
}
