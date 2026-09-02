import type { Player } from "@minecraft/server";
import { GameSystem } from "../core/System";
import type { SystemManager } from "../core/SystemManager";
import { Logger } from "../core/Logger";
import { GameConfig } from "../config/GameConfig";
import { readJson, writeJson } from "../core/persistence/DynamicPropertyCodec";
import { CurrencyComponent, CurrencyComponentKey } from "../economy/CurrencyComponent";
import type { PlayerSystem } from "./PlayerSystem";

const DYNAMIC_PROPERTY_KEY = "enchantedshop:currency";

/**
 * Owns every player's currency balance. Player entities disappear from the
 * API the moment they leave (PlayerLeaveAfterEvent only carries an id/name,
 * not a Player), so persistence can't wait for "on leave" - every mutation
 * persists immediately, backed by a periodic autosave as a safety net.
 */
export class CurrencySystem extends GameSystem {
  private readonly logger = new Logger("CurrencySystem");
  private readonly playerSystem: PlayerSystem;
  private secondsSinceAutosave = 0;

  public constructor(manager: SystemManager, playerSystem: PlayerSystem) {
    super(manager);
    this.playerSystem = playerSystem;
  }

  public onInit(): void {
    this.logger.info("ready.");
  }

  public override onPlayerSpawn(player: Player, initialSpawn: boolean): void {
    if (!initialSpawn) {
      return;
    }
    const gamePlayer = this.playerSystem.getGamePlayer(player.id);
    if (!gamePlayer) {
      return;
    }

    const stored = readJson<number | undefined>(player, DYNAMIC_PROPERTY_KEY, undefined);
    const component = CurrencyComponent.deserialize(stored ?? GameConfig.currency.startingBalance);
    gamePlayer.components.set(CurrencyComponentKey, component);

    if (stored === undefined) {
      // First time we've ever seen this player - persist the starting balance right away.
      this.persist(player, component);
    }
  }

  public override onSecond(): void {
    this.secondsSinceAutosave++;
    if (this.secondsSinceAutosave < GameConfig.autosaveIntervalSeconds) {
      return;
    }
    this.secondsSinceAutosave = 0;

    for (const player of this.playerSystem.getOnlinePlayers()) {
      const component = this.playerSystem.getGamePlayer(player.id)?.components.get(CurrencyComponentKey);
      if (component) {
        this.persist(player, component);
      }
    }
  }

  public getBalance(playerId: string): number {
    return this.playerSystem.getGamePlayer(playerId)?.components.get(CurrencyComponentKey)?.getBalance() ?? 0;
  }

  /** Deducts `amount`, persists immediately, and reports whether it succeeded. */
  public charge(player: Player, amount: number): boolean {
    const component = this.playerSystem.getGamePlayer(player.id)?.components.get(CurrencyComponentKey);
    if (!component || !component.remove(amount)) {
      return false;
    }
    this.persist(player, component);
    return true;
  }

  public grant(player: Player, amount: number): void {
    const component = this.playerSystem.getGamePlayer(player.id)?.components.get(CurrencyComponentKey);
    if (!component) {
      return;
    }
    component.add(amount);
    this.persist(player, component);
  }

  private persist(player: Player, component: CurrencyComponent): void {
    writeJson(player, DYNAMIC_PROPERTY_KEY, component.serialize());
  }
}
