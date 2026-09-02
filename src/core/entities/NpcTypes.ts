import type { Entity, Player, Vector3 } from "@minecraft/server";

/**
 * A live NPC tracked by EntitySystem: the static definition it was spawned
 * from, plus the actual Bedrock entity (once spawned - undefined for the
 * brief window right after world load before the spawn chunk is ticking,
 * or after the entity is otherwise invalidated and awaiting respawn).
 */
export interface SpawnedNpc {
  readonly definition: NpcDefinition;
  entity: Entity | undefined;
}

/**
 * A pluggable piece of NPC behavior. An NpcDefinition is a list of these -
 * e.g. Mister ShopMan combines a generic "stay put" behavior with a
 * shop-specific "open the shop UI" behavior - so a new NPC is composed
 * from behaviors rather than hand-rolled as its own System.
 */
export interface NpcBehavior {
  /** Runs once, right after the underlying entity is (re)spawned. */
  onAttach?(npc: SpawnedNpc): void;
  /** Runs when a player right-clicks/interacts with the NPC. */
  onInteract?(player: Player, npc: SpawnedNpc): void;
  /** Runs when a player melee-hits (punches) the NPC. */
  onHit?(player: Player, npc: SpawnedNpc): void;
  /** Runs every server tick while the NPC is spawned and valid. */
  onTick?(npc: SpawnedNpc, currentTick: number): void;
}

/** Everything EntitySystem needs to spawn, find, and maintain one NPC. */
export interface NpcDefinition {
  /** Unique key for this NPC (used for logging and internal bookkeeping). */
  readonly id: string;
  /** Namespaced entity type to spawn, e.g. MinecraftEntityTypes.VillagerV2. */
  readonly typeId: string;
  /** Tag used to (re-)identify this exact NPC across restarts, and to route interact/hit events to it. */
  readonly tag: string;
  readonly nameTag: string;
  readonly dimensionId: string;
  readonly spawnLocation: Vector3;
  readonly behaviors: readonly NpcBehavior[];
  /** If true, EntitySystem cancels all incoming damage for this NPC before it's ever applied - no HP loss, no hurt animation/knockback. */
  readonly invincible?: boolean;
}
