import { EntityComponentTypes, type Container, type EntityInventoryComponent, type Player } from "@minecraft/server";
import { GameSystem } from "../core/System";
import type { SystemManager } from "../core/SystemManager";
import { Logger } from "../core/Logger";
import { GameConfig } from "../config/GameConfig";
import { readJson, writeJson } from "../core/persistence/DynamicPropertyCodec";
import { createItemStacks, itemStackToDefinition, type ItemDefinition } from "../items/ItemFactory";
import { PendingDeliveryComponent, PendingDeliveryComponentKey, type PendingDeliverySnapshot } from "../economy/PendingDeliveryComponent";
import type { PlayerSystem } from "./PlayerSystem";

const DYNAMIC_PROPERTY_KEY = "enchantedshop:pendingDelivery";

export interface DeliveryOutcome {
  readonly queuedStackCount: number;
}

/**
 * The single place items ever enter a player's inventory. Guarantees the
 * "never dropped on the ground" rule from the spec: whatever doesn't fit is
 * queued on the player and retried whenever they have space, instead of
 * spilling onto the ground where it could be stolen.
 *
 * Persistence is the exact same pattern as CurrencySystem: the queue lives
 * in one per-player dynamic property (see DynamicPropertyCodec's
 * readJson/writeJson), written immediately on every mutation (deliver(),
 * retry()) rather than only on some periodic timer. That means a queued
 * delivery survives the server going down between the purchase and the
 * next retry exactly like a currency balance does - there's no in-memory-only
 * window where a restart could lose it.
 *
 * The retry loop itself runs off onTick (every GameConfig.delivery.retryIntervalTicks
 * ticks, decoupled from CurrencySystem's much slower autosaveIntervalSeconds -
 * a full inventory should clear itself out almost immediately once space
 * frees up, not wait up to a minute) - and pendingPlayerIds tracks which
 * online players currently have anything queued at all, so a server with
 * nobody's inventory full pays only a single Set.size check per tick
 * instead of looping every online player's component.
 */
export class DeliverySystem extends GameSystem {
  private readonly logger = new Logger("DeliverySystem");
  private readonly playerSystem: PlayerSystem;

  /**
   * Ids of online players who currently have at least one item queued.
   * Kept in sync by deliver()/retry()/onPlayerSpawn() (added) and
   * retry()/onPlayerLeave() (removed) so onTick's early-out is an O(1)
   * size check rather than a scan over every online player every interval.
   */
  private readonly pendingPlayerIds = new Set<string>();

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

    const snapshot = readJson<PendingDeliverySnapshot>(player, DYNAMIC_PROPERTY_KEY, []);
    const component = PendingDeliveryComponent.deserialize(snapshot);
    gamePlayer.components.set(PendingDeliveryComponentKey, component);

    if (!component.isEmpty()) {
      this.pendingPlayerIds.add(player.id);
      this.retry(player, component);
    }
  }

  public override onPlayerLeave(playerId: string, _playerName: string): void {
    // Nothing left to retry against while they're offline - onPlayerSpawn
    // re-adds them if their (still-persisted) queue is non-empty on rejoin.
    this.pendingPlayerIds.delete(playerId);
  }

  public override onTick(currentTick: number): void {
    // Cheapest possible early-out for the overwhelmingly common case where
    // nobody has anything queued: skip the interval math and the player
    // loop entirely instead of paying for either every single tick.
    if (this.pendingPlayerIds.size === 0) {
      return;
    }
    if (currentTick % GameConfig.delivery.retryIntervalTicks !== 0) {
      return;
    }

    for (const playerId of [...this.pendingPlayerIds]) {
      const gamePlayer = this.playerSystem.getGamePlayer(playerId);
      const component = gamePlayer?.components.get(PendingDeliveryComponentKey);
      if (!gamePlayer || !component || component.isEmpty()) {
        // Offline, no component yet, or already drained some other way -
        // nothing to retry against right now.
        this.pendingPlayerIds.delete(playerId);
        continue;
      }
      this.retry(gamePlayer.player, component);
    }
  }

  /**
   * Delivers every definition straight into `player`'s inventory. Anything
   * that doesn't fit is queued (persisted immediately) instead of being
   * dropped on the ground.
   *
   * Stacking onto the player's existing items is handled by the engine,
   * not reinvented here: `Container.addItem`'s own documented behavior is
   * "the item is placed in the first available slot(s) and can be stacked
   * with existing items of the same type" - confirmed against Microsoft's
   * Script API reference - so e.g. buying 3x arrows when the player
   * already has 40 in a stack merges onto that stack (up to its max size)
   * before ever touching an empty slot. That only works because
   * ItemFactory.createItemStacks applies the *same* enchantments/nameTag/
   * lore to every stack built from one definition - ItemStack.isStackableWith
   * compares those, so two stacks only merge if they actually match.
   */
  public deliver(player: Player, definitions: readonly ItemDefinition[]): DeliveryOutcome {
    const component = this.playerSystem.getGamePlayer(player.id)?.components.get(PendingDeliveryComponentKey);
    const container = this.getContainer(player);
    const leftovers: ItemDefinition[] = [];

    for (const definition of definitions) {
      for (const stack of createItemStacks(definition)) {
        const remainder = container?.addItem(stack);
        if (remainder) {
          leftovers.push(itemStackToDefinition(remainder));
        }
      }
    }

    if (leftovers.length > 0 && component) {
      component.enqueue(leftovers);
      this.persist(player, component);
      this.pendingPlayerIds.add(player.id);
      player.sendMessage(
        `§eYour inventory is full - ${leftovers.length} item stack(s) are queued and will be delivered as soon as you have space.`
      );
    }

    return { queuedStackCount: leftovers.length };
  }

  private retry(player: Player, component: PendingDeliveryComponent): void {
    const container = this.getContainer(player);
    if (!container) {
      return;
    }

    const definitions = component.drain();
    const stillStuck: ItemDefinition[] = [];

    for (const definition of definitions) {
      for (const stack of createItemStacks(definition)) {
        const remainder = container.addItem(stack);
        if (remainder) {
          stillStuck.push(itemStackToDefinition(remainder));
        }
      }
    }

    if (stillStuck.length > 0) {
      component.requeueFront(stillStuck);
    }
    this.persist(player, component);

    if (component.isEmpty()) {
      this.pendingPlayerIds.delete(player.id);
    } else {
      this.pendingPlayerIds.add(player.id);
    }

    if (definitions.length > 0 && stillStuck.length < definitions.length) {
      player.sendMessage("§aSome queued shop items were just delivered to your inventory.");
    }
  }

  private getContainer(player: Player): Container | undefined {
    const inventory = player.getComponent(EntityComponentTypes.Inventory) as EntityInventoryComponent | undefined;
    return inventory?.container;
  }

  private persist(player: Player, component: PendingDeliveryComponent): void {
    writeJson(player, DYNAMIC_PROPERTY_KEY, component.serialize());
  }
}
