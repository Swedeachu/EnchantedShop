import type { Scene } from "./Scene";
import type { SystemManager } from "../SystemManager";

export type SceneFactory = (manager: SystemManager) => Scene;

interface Registration {
  readonly factory: SceneFactory;
  readonly isDefault: boolean;
}

const registrations: Registration[] = [];

/**
 * One-line self-registration for a Scene: call this at the bottom of the
 * scene's own file (see LoadingScene.ts) and SceneSystem builds and
 * registers it automatically - no line to add inside SystemManager. Mark
 * exactly one scene `{ isDefault: true }` - that's where every player
 * lands on their first spawn.
 */
export function registerScene(factory: SceneFactory, options?: { isDefault?: boolean }): void {
  registrations.push({ factory, isDefault: options?.isDefault ?? false });
}

/** SceneSystem-only: every self-registered scene factory. */
export function getRegisteredSceneFactories(): readonly Registration[] {
  return [...registrations];
}
