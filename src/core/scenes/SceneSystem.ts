import type { Player } from "@minecraft/server";
import { GameSystem } from "../System";
import type { SystemManager } from "../SystemManager";
import { Logger } from "../Logger";
import type { Scene } from "./Scene";

/**
 * Registry + per-player switchboard for Scenes. Each Scene subclass has
 * exactly one shared instance (see Scene.ts) - this class only tracks
 * *which* shared instance each player is currently assigned to, so any
 * number of players can share the same scene at once. `onInit()` calls
 * every registered scene's `init()` once; the scene marked "default" via
 * `setDefaultSceneId()` is where every player lands on first spawn, free
 * to move themselves elsewhere from there (e.g. LoadingScene -> HubScene).
 */
export class SceneSystem extends GameSystem {
  private readonly logger = new Logger("SceneSystem");
  private readonly scenes = new Map<string, Scene>();
  private readonly playerScenes = new Map<string, Scene>();
  private defaultSceneId: string | undefined;

  public constructor(manager: SystemManager) {
    super(manager);
  }

  public onInit(): void {
    for (const scene of this.scenes.values()) {
      try {
        scene.init();
      } catch (error) {
        this.logger.error(`Scene "${scene.id}".init() threw - continuing with the rest of startup.`, error);
      }
    }
    this.logger.info(`ready. ${this.scenes.size} scene(s) registered.`);
  }

  public registerScene(scene: Scene): void {
    if (this.scenes.has(scene.id)) {
      throw new Error(`Scene "${scene.id}" is already registered.`);
    }
    this.scenes.set(scene.id, scene);
  }

  public getScene(id: string): Scene | undefined {
    return this.scenes.get(id);
  }

  /** The scene every player is placed into the moment they first spawn (see onPlayerSpawn below). */
  public setDefaultSceneId(id: string): void {
    this.defaultSceneId = id;
  }

  public getPlayerScene(playerId: string): Scene | undefined {
    return this.playerScenes.get(playerId);
  }

  /** Player ids currently in the given scene - cheap to call every second (see Scene.onSecond callers). */
  public getPlayerIdsInScene(sceneId: string): string[] {
    const ids: string[] = [];
    for (const [playerId, scene] of this.playerScenes) {
      if (scene.id === sceneId) {
        ids.push(playerId);
      }
    }
    return ids;
  }

  public setPlayerScene(player: Player, sceneId: string): void {
    const next = this.scenes.get(sceneId);
    if (!next) {
      throw new Error(`Cannot move ${player.name} into unknown scene "${sceneId}".`);
    }

    const previous = this.playerScenes.get(player.id);
    if (previous === next) {
      return;
    }

    previous?.onPlayerExit(player);
    this.playerScenes.set(player.id, next);
    next.onPlayerEnter(player);
    this.logger.debug(`${player.name}: ${previous?.id ?? "(none)"} -> ${sceneId}`);
  }

  public override onPlayerSpawn(player: Player, initialSpawn: boolean): void {
    if (!initialSpawn || !this.defaultSceneId) {
      return;
    }
    this.setPlayerScene(player, this.defaultSceneId);
  }

  public override onPlayerLeave(playerId: string, playerName: string): void {
    const scene = this.playerScenes.get(playerId);
    this.playerScenes.delete(playerId);
    if (scene) {
      this.logger.debug(`${playerName} left scene ${scene.id} (disconnected).`);
    }
  }

  public override onSecond(): void {
    for (const scene of this.scenes.values()) {
      if (this.getPlayerIdsInScene(scene.id).length > 0) {
        scene.onSecond();
      }
    }
  }
}
