import { world, system, type Entity, type Player } from "@minecraft/server";
import { Logger } from "./Logger";
import { GameSystem } from "./System";
import { SceneSystem } from "./scenes/SceneSystem";
import { EntitySystem } from "./entities/EntitySystem";
import { PlayerSystem } from "../systems/PlayerSystem";
import { CurrencySystem } from "../systems/CurrencySystem";
import { KitsSystem } from "../systems/KitsSystem";
import { DeliverySystem } from "../systems/DeliverySystem";
import { ShopSystem } from "../systems/ShopSystem";
import { LoadingScene, LOADING_SCENE_ID } from "../scenes/LoadingScene";
import { HubScene } from "../scenes/HubScene";

const TICKS_PER_SECOND = 20;

/**
 * The single root of the system graph: construct every system once, in a
 * fixed order, `init()` them together, and fan every subscribed event out
 * to all of them so each system only has to implement the hooks it
 * actually cares about.
 *
 * Add a new system by constructing it in the constructor (in the order it
 * should initialize/receive events) and exposing a typed getter, the same
 * way `getPlayerSystem()`/`getSceneSystem()` do below.
 */
export class SystemManager {
  private static instance: SystemManager | undefined;

  private readonly logger = new Logger("SystemManager");
  private readonly systems: GameSystem[] = [];
  private tickCount = 0;
  private tickRunId: number | undefined;
  private initialized = false;

  private readonly playerSystem: PlayerSystem;
  private readonly currencySystem: CurrencySystem;
  private readonly kitsSystem: KitsSystem;
  private readonly deliverySystem: DeliverySystem;
  private readonly shopSystem: ShopSystem;
  private readonly entitySystem: EntitySystem;
  private readonly sceneSystem: SceneSystem;

  private constructor() {
    // Registration order = init order = event-dispatch order. PlayerSystem
    // goes first (everything else reads getGamePlayer() from it), SceneSystem
    // goes last (its onPlayerSpawn is what places a joining player into
    // LoadingScene, which should only happen once every system above has
    // already hydrated that player's data).
    this.playerSystem = this.register(new PlayerSystem(this));
    this.currencySystem = this.register(new CurrencySystem(this, this.playerSystem));
    this.kitsSystem = this.register(new KitsSystem(this, this.playerSystem));
    this.deliverySystem = this.register(new DeliverySystem(this, this.playerSystem));
    this.shopSystem = this.register(new ShopSystem(this));
    this.entitySystem = this.register(new EntitySystem(this));
    this.sceneSystem = this.register(new SceneSystem(this));

    // Scenes own the gameplay content that lives in them (e.g. HubScene
    // owns Mister ShopMan) - SystemManager only registers the scenes
    // themselves, generically, the same way it registers systems above.
    // Later on maybe with reflection or some static factory pattern the 
    // derived scene files themselves can defer their registration automatically.
    this.sceneSystem.registerScene(new LoadingScene(this));
    this.sceneSystem.registerScene(new HubScene(this));
    this.sceneSystem.setDefaultSceneId(LOADING_SCENE_ID);
  }

  public static get(): SystemManager {
    if (!SystemManager.instance) {
      SystemManager.instance = new SystemManager();
    }
    return SystemManager.instance;
  }

  public getSceneSystem(): SceneSystem {
    return this.sceneSystem;
  }

  public getPlayerSystem(): PlayerSystem {
    return this.playerSystem;
  }

  public getCurrencySystem(): CurrencySystem {
    return this.currencySystem;
  }

  public getKitsSystem(): KitsSystem {
    return this.kitsSystem;
  }

  public getDeliverySystem(): DeliverySystem {
    return this.deliverySystem;
  }

  public getShopSystem(): ShopSystem {
    return this.shopSystem;
  }

  public getEntitySystem(): EntitySystem {
    return this.entitySystem;
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
