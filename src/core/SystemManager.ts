import { world, system, type Entity, type Player } from "@minecraft/server";
import { Logger } from "./Logger";
import { GameSystem } from "./System";
import { getRegisteredSystemFactories } from "./SystemRegistry";
import { SceneSystem } from "./scenes/SceneSystem";
import { EntitySystem } from "./entities/EntitySystem";
import { PlayerSystem } from "../systems/PlayerSystem";
import { CurrencySystem } from "../systems/CurrencySystem";
import { KitsSystem } from "../systems/KitsSystem";
import { DeliverySystem } from "../systems/DeliverySystem";
import { ShopSystem } from "../systems/ShopSystem";
// Side-effect only: guarantees esbuild bundles every gameplay system/scene
// file so its self-registration (registerSystem()/registerScene(), at the
// bottom of each file) actually runs - see src/systems/index.ts and
// src/scenes/index.ts. The named imports above already do this for
// core-provided systems (EntitySystem, SceneSystem) and for any gameplay
// system with a typed getter below; these two lines are the safety net
// for anything that isn't otherwise imported by name.
import "../systems";
import "../scenes";

const TICKS_PER_SECOND = 20;

/**
 * The single root of the system graph. Systems self-register (see
 * SystemRegistry.ts) instead of being constructed here by hand - this
 * class just builds whatever's registered, in the order each one asked
 * for, then fans every subscribed event out to all of them so each system
 * only has to implement the hooks it actually cares about.
 *
 * Adding a new system needs nothing here: write the file, call
 * registerSystem() at its bottom, and (only if other code needs to fetch
 * it by name) add a one-line typed getter below, the same way
 * getPlayerSystem() does.
 */
export class SystemManager {
  private static instance: SystemManager | undefined;

  private readonly logger = new Logger("SystemManager");
  private readonly systems: GameSystem[] = [];
  private tickCount = 0;
  private tickRunId: number | undefined;
  private initialized = false;

  private constructor() {
    for (const factory of getRegisteredSystemFactories()) {
      this.register(factory(this));
    }
  }

  public static get(): SystemManager {
    if (!SystemManager.instance) {
      SystemManager.instance = new SystemManager();
    }
    return SystemManager.instance;
  }

  /** Finds the one instance of a registered system by its class - a cheap linear scan, fine for a handful of systems. */
  public getSystem<T extends GameSystem>(ctor: abstract new (...args: any[]) => T): T {
    const found = this.systems.find((candidate): candidate is T => candidate instanceof ctor);
    if (!found) {
      throw new Error(
        `System "${ctor.name}" isn't registered - check it calls registerSystem() at the bottom of its file, and that the file is reachable from SystemManager (directly, or via src/systems/index.ts).`
      );
    }
    return found;
  }

  public getSceneSystem(): SceneSystem {
    return this.getSystem(SceneSystem);
  }

  public getPlayerSystem(): PlayerSystem {
    return this.getSystem(PlayerSystem);
  }

  public getCurrencySystem(): CurrencySystem {
    return this.getSystem(CurrencySystem);
  }

  public getKitsSystem(): KitsSystem {
    return this.getSystem(KitsSystem);
  }

  public getDeliverySystem(): DeliverySystem {
    return this.getSystem(DeliverySystem);
  }

  public getShopSystem(): ShopSystem {
    return this.getSystem(ShopSystem);
  }

  public getEntitySystem(): EntitySystem {
    return this.getSystem(EntitySystem);
  }

  private register<T extends GameSystem>(gameSystem: T): T {
    this.systems.push(gameSystem);
    return gameSystem;
  }

  /** Call once, after the world has finished loading (see src/main.ts). */
  public init(): void {
    if (this.initialized) {
      this.logger.warn("init() called more than once - ignoring.");
      return;
    }
    this.initialized = true;

    // Each system's onInit runs in isolation: a bug (or an unrecoverable
    // world-state issue) in one system logs here and moves on, rather than
    // throwing out of this loop and silently skipping every system after
    // it - including SceneSystem, whose onPlayerSpawn handler is what puts
    // joining players anywhere at all.
    for (const gameSystem of this.systems) {
      try {
        gameSystem.onInit();
      } catch (error) {
        this.logger.error(`${gameSystem.constructor.name}.onInit() threw - continuing with the rest of startup.`, error);
      }
    }

    this.subscribeToEvents();
    this.startTickLoop();

    this.logger.info(`Initialized ${this.systems.length} systems.`);
  }

  public shutdown(): void {
    if (this.tickRunId !== undefined) {
      system.clearRun(this.tickRunId);
      this.tickRunId = undefined;
    }

    for (const gameSystem of this.systems) {
      gameSystem.onShutdown();
    }

    this.logger.info("Shutdown complete.");
  }

  private subscribeToEvents(): void {
    world.afterEvents.playerJoin.subscribe((event) => {
      this.logger.debug(`playerJoin: ${event.playerName} (${event.playerId})`);
      for (const gameSystem of this.systems) {
        gameSystem.onPlayerJoin(event.playerId, event.playerName);
      }
    });

    world.afterEvents.playerSpawn.subscribe((event) => {
      this.logger.debug(`playerSpawn: ${event.player.name} initialSpawn=${event.initialSpawn}`);
      for (const gameSystem of this.systems) {
        gameSystem.onPlayerSpawn(event.player as Player, event.initialSpawn);
      }
    });

    world.afterEvents.playerLeave.subscribe((event) => {
      this.logger.debug(`playerLeave: ${event.playerName} (${event.playerId})`);
      for (const gameSystem of this.systems) {
        gameSystem.onPlayerLeave(event.playerId, event.playerName);
      }
    });

    world.afterEvents.playerInteractWithEntity.subscribe((event) => {
      for (const gameSystem of this.systems) {
        gameSystem.onPlayerInteractWithEntity(event.player, event.target as Entity);
      }
    });

    world.afterEvents.entityHitEntity.subscribe((event) => {
      // Only a player's punch counts - ignore mob-on-mob/mob-on-player hits.
      if (event.damagingEntity.typeId !== "minecraft:player") {
        return;
      }
      const player = event.damagingEntity as Player;
      for (const gameSystem of this.systems) {
        gameSystem.onPlayerHitEntity(player, event.hitEntity);
      }
    });

    system.beforeEvents.shutdown.subscribe(() => {
      this.shutdown();
    });
  }

  private startTickLoop(): void {
    this.tickRunId = system.runInterval(() => {
      this.tickCount++;

      for (const gameSystem of this.systems) {
        gameSystem.onTick(this.tickCount);
      }

      if (this.tickCount % TICKS_PER_SECOND === 0) {
        for (const gameSystem of this.systems) {
          gameSystem.onSecond();
        }
      }
    }, 1);
  }
}
