import type { Player } from "@minecraft/server";
import type { SystemManager } from "../SystemManager";

/**
 * Base class every scene extends. SceneSystem owns the single shared
 * instance of each one, built from self-registration - call registerScene()
 * at the bottom of your file (see SceneRegistry.ts).
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
