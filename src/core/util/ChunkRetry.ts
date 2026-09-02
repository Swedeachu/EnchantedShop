import { system, LocationInUnloadedChunkError } from "@minecraft/server";
import type { Logger } from "../Logger";

/**
 * Right after `world.afterEvents.worldLoad` fires - which is when we bring
 * every system online (see SystemManager.init()) - the chunk(s) around
 * world spawn are not guaranteed to be loaded/ticking yet, especially on a
 * brand-new world with no players around to force them. Any script call
 * that touches a specific location there (spawnEntity, fillBlocks, ...)
 * can throw `LocationInUnloadedChunkError` in that narrow window.
 *
 * This retries `action` on a short timer until it stops throwing that
 * specific error, giving the world a moment to catch up, instead of
 * letting the error propagate and abort whatever init pass called us -
 * which is what silently killed the rest of startup before this existed
 * (see EntitySystem.ensureSpawned / SpawnPlatform.ensureHubPlatformBuilt).
 * Any other kind of error is not retried - it's rethrown immediately.
 */
export function retryOnUnloadedChunk(
  action: () => void,
  options: {
    logger: Logger;
    description: string;
    maxAttempts?: number;
    retryDelayTicks?: number;
    onGiveUp?: () => void;
  }
): void {
  const { logger, description, maxAttempts = 100, retryDelayTicks = 10, onGiveUp } = options;
  let attempts = 0;

  const attempt = (): void => {
    attempts++;
    try {
      action();
    } catch (error) {
      if (!(error instanceof LocationInUnloadedChunkError)) {
        onGiveUp?.();
        throw error;
      }

      if (attempts >= maxAttempts) {
        logger.error(`${description}: gave up after ${attempts} attempts - the chunk never started ticking.`, error);
        onGiveUp?.();
        return;
      }

      logger.debug(`${description}: chunk not ticking yet (attempt ${attempts}/${maxAttempts}) - retrying shortly.`);
      system.runTimeout(attempt, retryDelayTicks);
    }
  };

  attempt();
}
