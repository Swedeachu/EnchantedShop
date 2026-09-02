import type { Player } from "@minecraft/server";
import { GameSystem } from "../core/System";
import { registerSystem, SystemOrder } from "../core/SystemRegistry";
import type { SystemManager } from "../core/SystemManager";
import { Logger } from "../core/Logger";
import { ComponentContainer } from "../core/components/ComponentContainer";
import { hydratePlayerComponents } from "../core/components/ComponentRegistry";

/**
 * Per-player runtime state. Currency balance, owned-kit tracking, pending
 * deliveries, etc. each attach as their own component on `components` (see
 * ComponentContainer) rather than as fields bolted directly onto this
 * class, so other systems can own their own slice of player state without
 * editing this file.
 *
 * Holds the live `Player` reference too - Player entities disappear from
 * the API the instant they leave (PlayerLeaveAfterEvent only carries an
 * id/name), so any system that needs to act on an *online* player later
 * (autosave, retrying a queued delivery, ...) gets it from here rather than
 * trying to re-look it up.
 */
export class GamePlayer {
  public readonly id: string;
  public readonly name: string;
  public readonly player: Player;
  public readonly components = new ComponentContainer();

  public constructor(player: Player) {
    this.id = player.id;
    this.name = player.name;
    this.player = player;
  }
}

/**
 * Tracks who is online. Self-registers with SystemOrder.First (see
 * SystemRegistry.ts) so its onPlayerSpawn always runs before every other
 * system's - it creates the GamePlayer and hydrates every self-registered
 * component onto it (see ComponentRegistry.ts) before anything else's
 * onPlayerSpawn can assume getGamePlayer() is already populated.
 */
export class PlayerSystem extends GameSystem {
  private readonly logger = new Logger("PlayerSystem");
  private readonly online = new Map<string, GamePlayer>();

  public constructor(manager: SystemManager) {
    super(manager);
  }

  public onInit(): void {
    this.logger.info("ready.");
  }

  public override onPlayerJoin(_playerId: string, playerName: string): void {
    this.logger.info(`${playerName} is connecting...`);
  }

  public override onPlayerSpawn(player: Player, initialSpawn: boolean): void {
    if (!initialSpawn) {
      // A respawn after death, not a new session - GamePlayer already exists.
      return;
    }

    const gamePlayer = new GamePlayer(player);
    this.online.set(player.id, gamePlayer);
    hydratePlayerComponents(player, gamePlayer.components);
    this.logger.info(`${player.name} spawned for the first time this session.`);
  }

  public override onPlayerLeave(playerId: string, playerName: string): void {
    this.online.delete(playerId);
    this.logger.info(`${playerName} disconnected.`);
  }

  public override onSecond(): void {
    for (const gamePlayer of this.online.values()) {
      if (!gamePlayer.player.isValid) {
        continue;
      }
      // hack for no hunger, saturation effect would be better, BDS should make hunger a gamerule
      gamePlayer.player.getComponent("minecraft:player.hunger")?.resetToMaxValue(); 
    }
  }

  public getGamePlayer(playerId: string): GamePlayer | undefined {
    return this.online.get(playerId);
  }

  public getOnlinePlayers(): Player[] {
    return [...this.online.values()].map((gamePlayer) => gamePlayer.player);
  }

  public getOnlineCount(): number {
    return this.online.size;
  }
}

// Self-registers with SystemManager - see SystemRegistry.ts. First, so
// every other system can rely on getGamePlayer() already being populated.
registerSystem((manager) => new PlayerSystem(manager), SystemOrder.First);
