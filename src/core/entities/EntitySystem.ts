import { system, world, type Entity, type Player } from "@minecraft/server";
import { GameSystem } from "../System";
import type { SystemManager } from "../SystemManager";
import { Logger } from "../Logger";
import { retryOnUnloadedChunk } from "../util/ChunkRetry";
import type { NpcDefinition, SpawnedNpc } from "./NpcTypes";

/**
 * Generic registry + spawner for scripted NPCs (Mister ShopMan today,
 * anything else later): each NpcDefinition says where/what to spawn, and a
 * list of NpcBehaviors get interact/hit/tick fanned out to them. Adding a
 * new NPC means describing one (see src/entities/ShopManNpc.ts) and calling
 * registerNpc() - not writing a new System for it.
 */
export class EntitySystem extends GameSystem {
  private readonly logger = new Logger("EntitySystem");
  private readonly npcs: SpawnedNpc[] = [];
  private readonly spawnInFlight = new Set<string>();

  public constructor(manager: SystemManager) {
    super(manager);
    this.subscribeToEvents();
  }

  /**
   * Two things vanilla would otherwise do on its own, that we need to
   * intercept before they happen rather than react to after the fact:
   *
   *  - Right-clicking any villager opens vanilla's trade UI. Cancelling
   *    playerInteractWithEntity's *before* event stops that outright, and
   *    we run our own onInteract behaviors right after (deferred one tick
   *    via system.run(), since before-event callbacks run in
   *    restricted-execution mode and can't open UI forms directly).
   *  - Damage on an invincible NPC needs to never register at all - not
   *    just be reduced to 0 HP lost - so it can't flash/react. Cancelling
   *    entityHurt's *before* event stops it before any of that happens -
   *    this is the only layer doing that (NPCs are plain vanilla entity
   *    types, so there's no entity-definition component to lean on too).
   */
  private subscribeToEvents(): void {
    world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
      const npc = this.findByEntity(event.target);
      if (!npc) {
        return;
      }
      event.cancel = true;

      const { player } = event;
      system.run(() => {
        if (!player.isValid) {
          return;
        }
        for (const behavior of npc.definition.behaviors) {
          behavior.onInteract?.(player, npc);
        }
      });
    });

    world.beforeEvents.entityHurt.subscribe((event) => {
      const npc = this.findByEntity(event.hurtEntity);
      if (npc?.definition.invincible) {
        event.cancel = true;
      }
    });
  }

  /** Register an NPC to be spawned/maintained. Call before onInit() runs (i.e. from SystemManager's constructor). */
  public registerNpc(definition: NpcDefinition): void {
    if (this.npcs.some((npc) => npc.definition.tag === definition.tag)) {
      throw new Error(`NPC tag "${definition.tag}" is already registered.`);
    }
    this.npcs.push({ definition, entity: undefined });
  }

  public onInit(): void {
    for (const npc of this.npcs) {
      this.ensureSpawned(npc);
    }
  }

  public override onTick(currentTick: number): void {
    for (const npc of this.npcs) {
      if (!npc.entity || !npc.entity.isValid) {
        this.ensureSpawned(npc);
        continue;
      }
      for (const behavior of npc.definition.behaviors) {
        behavior.onTick?.(npc, currentTick);
      }
    }
  }

  // Interact is handled via the beforeEvents.playerInteractWithEntity
  // subscription above instead of this after-event hook - see
  // subscribeToEvents()'s doc comment for why.

  public override onPlayerHitEntity(player: Player, target: Entity): void {
    const npc = this.findByEntity(target);
    if (!npc) {
      return;
    }
    for (const behavior of npc.definition.behaviors) {
      behavior.onHit?.(player, npc);
    }
  }

  private findByEntity(target: Entity): SpawnedNpc | undefined {
    if (!target.isValid) {
      return undefined;
    }
    for (const npc of this.npcs) {
      if (target.hasTag(npc.definition.tag)) {
        return npc;
      }
    }
    return undefined;
  }

  /**
   * NPCs are treated like statues, not saved state: never "found again"
   * from whatever the world file happens to have saved (stale data,
   * duplicates from an old bug, whatever) - every time this runs, any
   * stray entity already wearing this NPC's tag is removed first, and a
   * brand new one is spawned fresh. That makes "what's actually standing
   * there" fully owned by this script every single boot, with no
   * ambiguity about whether a found entity is really "the same" NPC.
   *
   * Safe to call repeatedly (idempotent while a spawn is in flight) -
   * `spawnInFlight` stops onInit's call and the very next onTick's call
   * (before the first attempt's retry loop has resolved) from both
   * kicking off their own spawn.
   */
  private ensureSpawned(npc: SpawnedNpc): void {
    if (this.spawnInFlight.has(npc.definition.id)) {
      return;
    }
    this.spawnInFlight.add(npc.definition.id);

    const dimension = world.getDimension(npc.definition.dimensionId);

    retryOnUnloadedChunk(
      () => {
        for (const stray of dimension.getEntities({ tags: [npc.definition.tag] })) {
          stray.remove();
        }

        const entity = dimension.spawnEntity(npc.definition.typeId, npc.definition.spawnLocation);
        entity.nameTag = npc.definition.nameTag;
        entity.addTag(npc.definition.tag);
        npc.entity = entity;
        this.spawnInFlight.delete(npc.definition.id);
        this.logger.info(`Spawned NPC "${npc.definition.id}".`);

        for (const behavior of npc.definition.behaviors) {
          behavior.onAttach?.(npc);
        }
      },
      {
        logger: this.logger,
        description: `Spawn NPC "${npc.definition.id}"`,
        onGiveUp: () => {
          this.spawnInFlight.delete(npc.definition.id);
        }
      }
    );
  }
}
