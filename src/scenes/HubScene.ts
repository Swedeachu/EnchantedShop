import { world, DisplaySlotId, type Player, type ScoreboardObjective } from "@minecraft/server";
import { Scene } from "../core/scenes/Scene";
import type { SystemManager } from "../core/SystemManager";
import { Logger } from "../core/Logger";
import { GameConfig } from "../config/GameConfig";
import { ensureHubPlatformBuilt } from "../world/SpawnPlatform";
import { lockTimeAtNoon } from "../world/WorldSettings";

export const HUB_SCENE_ID = "hub";

/**
 * The PvP lobby itself - a single shared instance, not one per player (see
 * Scene.ts's doc comment): every player LoadingScene hands off lands in
 * this same in-memory Hub, at the same time as everyone else currently
 * there, seeing the same Mister ShopMan, the same scoreboard objective,
 * the same flat platform. `init()` runs once, after the world has loaded
 * (see SceneSystem.onInit): it carves out the flat spawn platform, points
 * the world's default spawn at it, and sets up the currency scoreboard.
 * Mister ShopMan himself is spawned/maintained independently by
 * EntitySystem - see ShopManNpc.ts - so this scene doesn't need to know he
 * exists. The only thing that varies per player here is each player's own
 * data (currency balance, in `onPlayerEnter`'s scoreboard refresh) - never
 * anything about the Hub itself.
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
