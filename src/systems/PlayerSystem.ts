import type { Player } from "@minecraft/server";
import { GameSystem } from "../core/System";
import type { SystemManager } from "../core/SystemManager";
import { Logger } from "../core/Logger";
import { ComponentContainer } from "../core/components/ComponentContainer";

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
 * First concrete derived system: tracks who is online and demonstrates the
 * join/spawn/leave event hooks every later system (Currency, Kits,
 * Delivery, Shop, ShopMan) subscribes to through the same GameSystem base.
 *
 * Registered first, so its onPlayerSpawn always creates the GamePlayer
 * before any later-registered system's onPlayerSpawn runs (registration
 * order = event-dispatch order - see SystemManager) and can safely assume
 * getGamePlayer() is already populated.
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

    this.online.set(player.id, new GamePlayer(player));
    this.logger.info(`${player.name} spawned for the first time this session.`);
  }

  public override onPlayerLeave(playerId: string, playerName: string): void {
    this.online.delete(playerId);
    this.logger.info(`${playerName} disconnected.`);
  }

  /**
   * Hunger is disabled server-wide: there's no gamerule for this (Bedrock,
   * like Java, only has gamerules around regen/damage-from-hunger, not
   * depletion itself), so instead every online player's hunger attribute
   * gets topped back up to max once a second - cheap, and frequent enough
   * that the hunger bar never visibly drops even under sprint/jump
   * exhaustion.
   */
  public override onSecond(): void {
    for (const gamePlayer of this.online.values()) {
      if (!gamePlayer.player.isValid) {
        continue;
      }
      gamePlayer.player.getComponent("minecraft:player.hunger")?.resetToMaxValue(); // hack for no hunger, saturation effect would be better, BDS should make hunger a gamerule
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
