import { world, DisplaySlotId, type Player, type ScoreboardObjective } from "@minecraft/server";
import { Scene } from "../core/scenes/Scene";
import { registerScene } from "../core/scenes/SceneRegistry";
import type { SystemManager } from "../core/SystemManager";
import { Logger } from "../core/Logger";
import { GameConfig } from "../config/GameConfig";
import { ensureHubPlatformBuilt } from "../world/SpawnPlatform";
import { lockTimeAtNoon } from "../world/WorldSettings";
import { createShopManNpc } from "../entities/ShopManNpc";

export const HUB_SCENE_ID = "hub";

/**
 * The PvP lobby itself - a single shared instance the players exist in.
 * Owns Mister ShopMan: builds his definition and registers him with
 * EntitySystem in init(), so EntitySystem stays generic and nothing
 * outside the Hub needs to know he exists.
 */
export class HubScene extends Scene {
  private readonly logger = new Logger("HubScene");
  private scoreboardObjective: ScoreboardObjective | undefined;

  public constructor(manager: SystemManager) {
    super(manager, HUB_SCENE_ID);
  }

  public override init(): void {
    const dimension = world.getDimension(GameConfig.hub.dimensionId);

    ensureHubPlatformBuilt(dimension);
    world.setDefaultSpawnLocation(GameConfig.hub.spawnLocation);
    lockTimeAtNoon();

    this.scoreboardObjective = this.setUpScoreboard();
    this.disableDamageInHub();
    this.manager.getEntitySystem().registerNpc(createShopManNpc(this.manager));

    this.logger.info("Hub ready.");
  }

  /** The Hub is a safe zone - no PvP, no fall damage, nothing - for any player currently in this scene. */
  private disableDamageInHub(): void {
    world.beforeEvents.entityHurt.subscribe((event) => {
      const { hurtEntity } = event;
      if (hurtEntity.typeId !== "minecraft:player") {
        return;
      }
      if (this.manager.getSceneSystem().getPlayerScene(hurtEntity.id) === this) {
        event.cancel = true;
      }
    });
  }

  public override onPlayerEnter(player: Player): void {
    player.teleport(GameConfig.hub.spawnLocation, { dimension: world.getDimension(GameConfig.hub.dimensionId) });
    this.refreshScore(player);
    player.sendMessage(`§aWelcome to the Enchanted Shop hub! §7Talk to §6Mister ShopMan §7to browse the shop.`);
    this.logger.info(`${player.name} entered the Hub.`);
  }

  public override onPlayerExit(player: Player): void {
    this.logger.debug(`${player.name} left the Hub.`);
  }

  /** Keeps every hub player's on-screen balance in sync with purchases, /money grants, etc. */
  public override onSecond(): void {
    if (!this.scoreboardObjective) {
      return;
    }
    for (const playerId of this.manager.getSceneSystem().getPlayerIdsInScene(HUB_SCENE_ID)) {
      const gamePlayer = this.manager.getPlayerSystem().getGamePlayer(playerId);
      if (gamePlayer) {
        this.refreshScore(gamePlayer.player);
      }
    }
  }

  private refreshScore(player: Player): void {
    if (!this.scoreboardObjective) {
      return;
    }
    const balance = this.manager.getCurrencySystem().getBalance(player.id);
    this.scoreboardObjective.setScore(player, balance);
  }

  private setUpScoreboard(): ScoreboardObjective {
    const { objectiveId, displayName } = GameConfig.hub.scoreboard;
    const existing = world.scoreboard.getObjective(objectiveId);
    const objective = existing ?? world.scoreboard.addObjective(objectiveId, displayName);
    world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, { objective });
    return objective;
  }
}

// Self-registers with SceneSystem - see SceneRegistry.ts.
registerScene((manager) => new HubScene(manager));
