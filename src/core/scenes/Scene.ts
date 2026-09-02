import type { Player } from "@minecraft/server";
import type { SystemManager } from "../SystemManager";

/**
 * A named, swappable slice of "what's happening right now" - a shared
 * place, not a per-player one. Exactly one instance of each Scene subclass
 * is ever constructed (see SystemManager's constructor - `new HubScene(this)`
 * runs once, not once per player), the same way there's only one instance
 * of any other system. `init()` runs once on that shared instance, and any
 * number of players can be inside it at the same time - `HubScene` in
 * particular is a shared lobby: every player currently in it is standing
 * in the same in-memory Hub, seeing the same Mister ShopMan, the same
 * scoreboard objective, the same flat platform. `onPlayerEnter`/
 * `onPlayerExit` are just per-player *notifications* on that one shared
 * instance (SceneSystem tracks which scene each player is currently
 * assigned to, so it knows who to notify) - they are not separate copies
 * of scene state. Anything that genuinely needs to differ per player
 * (currency balance, owned kits, ...) belongs on that player's
 * ComponentContainer instead, never as a field on a Scene.
 *
 * Constructed with a reference to the SystemManager (so it can pull
 * whatever systems it needs, the same way GameSystem subclasses do).
 */
export abstract class Scene {
  public readonly id: string;
  protected readonly manager: SystemManager;

  protected constructor(manager: SystemManager, id: string) {
    this.manager = manager;
    this.id = id;
  }

  /** Called once, when the world has finished loading (see SceneSystem.onInit). Safe to touch world/entity state here. */
  public init(): void {
    // no-op by default
  }

  /** Called when a player is placed into this scene. */
  public onPlayerEnter(_player: Player): void {
    // no-op by default
  }

  /** Called when a player leaves this scene (moves to a different one, or disconnects). */
  public onPlayerExit(_player: Player): void {
    // no-op by default
  }

  /** Called roughly once per second, only while at least one player is in this scene. */
  public onSecond(): void {
    // no-op by default
  }
}
