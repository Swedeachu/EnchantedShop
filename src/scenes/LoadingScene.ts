import { system, type Player } from "@minecraft/server";
import { Scene } from "../core/scenes/Scene";
import type { SystemManager } from "../core/SystemManager";
import { Logger } from "../core/Logger";
import { formatCurrency } from "../shop/ShopFormatting";
import { HUB_SCENE_ID } from "./HubScene";

export const LOADING_SCENE_ID = "loading";

/**
 * The default scene every player is placed into the instant they first
 * spawn - a single shared instance, like every Scene. Every other system
 * is registered before SceneSystem, so by the time onPlayerEnter runs here
 * their data is already hydrated; this scene is just the well-defined
 * "your data is ready" checkpoint before handing off to HubScene.
 */
export class LoadingScene extends Scene {
  private readonly logger = new Logger("LoadingScene");

  public constructor(manager: SystemManager) {
    super(manager, LOADING_SCENE_ID);
  }

  public override onPlayerEnter(player: Player): void {
    this.logger.info(`Loading data for ${player.name}...`);
    player.sendMessage("§7Loading your data...");

    // Deferred one tick so this never races the engine's own initial-spawn
    // placement, which is still settling on the same tick playerSpawn fires.
    system.runTimeout(() => this.finishLoading(player), 1);
  }

  private finishLoading(player: Player): void {
    if (!player.isValid) {
      // Disconnected during the 1-tick defer.
      return;
    }

    const currencySystem = this.manager.getCurrencySystem();
    const kitsSystem = this.manager.getKitsSystem();
    const balance = currencySystem.getBalance(player.id);
    const ownedKitCount = kitsSystem.getOwnedKitIds(player.id).length;

    this.logger.info(
      `${player.name} finished loading: ${formatCurrency(balance)}, ${ownedKitCount} kit(s) owned - entering Hub.`
    );

    this.manager.getSceneSystem().setPlayerScene(player, HUB_SCENE_ID);
  }
}
