import type { Player } from "@minecraft/server";
import { GameSystem } from "../core/System";
import type { SystemManager } from "../core/SystemManager";
import { Logger } from "../core/Logger";
import { readJson, writeJson } from "../core/persistence/DynamicPropertyCodec";
import { KITS_CONFIG } from "../kits/KitsConfig";
import { KitCategory, type KitDefinition } from "../kits/KitTypes";
import { OwnedKitsComponent, OwnedKitsComponentKey, type OwnedKitsSnapshot } from "../kits/OwnedKitsComponent";
import type { PlayerSystem } from "./PlayerSystem";

const DYNAMIC_PROPERTY_KEY = "enchantedshop:ownedKits";

/** Loads KITS_CONFIG into a category-indexed registry, and tracks purchase history per player. */
export class KitsSystem extends GameSystem {
  private readonly logger = new Logger("KitsSystem");
  private readonly playerSystem: PlayerSystem;
  private readonly byId = new Map<string, KitDefinition>();
  private readonly byCategory = new Map<KitCategory, KitDefinition[]>();

  public constructor(manager: SystemManager, playerSystem: PlayerSystem) {
    super(manager);
    this.playerSystem = playerSystem;
  }

  public onInit(): void {
    for (const kit of KITS_CONFIG) {
      if (this.byId.has(kit.id)) {
        throw new Error(`Duplicate kit id in KITS_CONFIG: "${kit.id}".`);
      }
      this.byId.set(kit.id, kit);

      const bucket = this.byCategory.get(kit.category) ?? [];
      bucket.push(kit);
      this.byCategory.set(kit.category, bucket);
    }
    this.logger.info(`Loaded ${this.byId.size} kits across ${this.byCategory.size} categories.`);
  }

  public getKit(kitId: string): KitDefinition | undefined {
    return this.byId.get(kitId);
  }

  public getCategories(): KitCategory[] {
    return [...this.byCategory.keys()];
  }

  public getKitsInCategory(category: KitCategory): readonly KitDefinition[] {
    return this.byCategory.get(category) ?? [];
  }

  public override onPlayerSpawn(player: Player, initialSpawn: boolean): void {
    if (!initialSpawn) {
      return;
    }
    const gamePlayer = this.playerSystem.getGamePlayer(player.id);
    if (!gamePlayer) {
      return;
    }

    const snapshot = readJson<OwnedKitsSnapshot>(player, DYNAMIC_PROPERTY_KEY, {});
    gamePlayer.components.set(OwnedKitsComponentKey, OwnedKitsComponent.deserialize(snapshot));
  }

  public getOwnedCount(playerId: string, kitId: string): number {
    return this.playerSystem.getGamePlayer(playerId)?.components.get(OwnedKitsComponentKey)?.getCount(kitId) ?? 0;
  }

  /** Ids of every kit this player owns at least one of - used by LoadingScene's "finished loading" summary. */
  public getOwnedKitIds(playerId: string): string[] {
    return this.playerSystem.getGamePlayer(playerId)?.components.get(OwnedKitsComponentKey)?.getOwnedKitIds() ?? [];
  }

  /** Records a purchase and persists immediately - called right after a successful buy. */
  public recordPurchase(player: Player, kitId: string, quantity: number): void {
    const component = this.playerSystem.getGamePlayer(player.id)?.components.get(OwnedKitsComponentKey);
    if (!component) {
      return;
    }
    component.recordPurchase(kitId, quantity);
    writeJson(player, DYNAMIC_PROPERTY_KEY, component.serialize());
  }
}
