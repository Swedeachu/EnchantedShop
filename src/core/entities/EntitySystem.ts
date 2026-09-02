import { system, world, type Entity, type Player } from "@minecraft/server";
import { GameSystem } from "../System";
import type { SystemManager } from "../SystemManager";
import { Logger } from "../Logger";
import { retryOnUnloadedChunk } from "../util/ChunkRetry";
import type { NpcDefinition, SpawnedNpc } from "./NpcTypes";

/**
 * Generic registry + spawner for scripted NPCs. Knows nothing about any
 * specific NPC - each NpcDefinition says where/what to spawn, and a list
 * of NpcBehaviors get interact/hit/tick fanned out to them. Whoever owns
 * an NPC conceptually (e.g. HubScene owns Mister ShopMan) builds its
 * definition and calls registerNpc() - adding a new NPC never means
 * touching this file.
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
   * Two things vanilla does on its own that we intercept before they
   * happen: right-clicking any villager opens vanilla's trade UI (cancel
   * the *before* event, then run our own onInteract behaviors deferred one
   * tick via system.run(), since before-event callbacks run in restricted
   * execution and can't open UI forms directly); damage on an invincible
   * NPC must never register at all, not just be reduced to 0 (cancel
   * entityHurt's *before* event).
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

  /**
   * Register an NPC to be spawned/maintained. Safe to call any time before
   * the tick loop starts - typically from a Scene's init() (e.g.
   * HubScene registering Mister ShopMan), which runs after this system's
   * own onInit(). Either way onTick spawns anything not yet spawned on its
   * very next pass, so registering "late" just means spawning one tick later.
   */
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
   * NPCs are statues, not saved state: never "found again" from whatever
   * the world file happens to have saved - any stray entity already
   * wearing this NPC's tag is removed first, then a fresh one is spawned.
   * `spawnInFlight` makes repeat calls idempotent while a spawn attempt's
   * retry loop is still in progress.
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
