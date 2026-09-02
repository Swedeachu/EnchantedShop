import type { Entity, Player } from "@minecraft/server";
import type { SystemManager } from "./SystemManager";

/**
 * Base class every derived system extends. `SystemManager` owns the single
 * instance of each one (built from self-registration - call registerSystem()
 * at the bottom of your file, see SystemRegistry.ts) and fans world/system
 * events out to all of them, so subclasses only override the hooks they
 * actually care about instead of wiring up their own event subscriptions.
 */
export abstract class GameSystem {
  protected readonly manager: SystemManager;

  protected constructor(manager: SystemManager) {
    this.manager = manager;
  }

  /** Called once, in registration order, once the world has finished loading. */
  public abstract onInit(): void;

  /** Called every server tick (~20/s). Override only if the system needs per-tick work. */
  public onTick(_currentTick: number): void {
    // no-op by default
  }

  /** Called roughly once per second (every 20 ticks). Good for polling/expensive checks. */
  public onSecond(): void {
    // no-op by default
  }

  /** Fires once, the moment a player's client finishes connecting (world.afterEvents.playerJoin). */
  public onPlayerJoin(_playerId: string, _playerName: string): void {
    // no-op by default
  }

  /** Fires on every spawn/respawn. `initialSpawn` is true only for the very first spawn after joining. */
  public onPlayerSpawn(_player: Player, _initialSpawn: boolean): void {
    // no-op by default
  }

  /** Fires when a player disconnects. The Player object is already invalid by this point - use the id/name. */
  public onPlayerLeave(_playerId: string, _playerName: string): void {
    // no-op by default
  }

  /** Fires when a player interacts with (right-clicks) an entity - e.g. talking to Mister ShopMan. */
  public onPlayerInteractWithEntity(_player: Player, _target: Entity): void {
    // no-op by default
  }

  /** Fires when a player melee-hits (punches) an entity - e.g. punching Mister ShopMan to open the shop UI. */
  public onPlayerHitEntity(_player: Player, _target: Entity): void {
    // no-op by default
  }

  /** Fires once when the pack is shutting down (system.beforeEvents.shutdown). */
  public onShutdown(): void {
    // no-op by default
  }
}
