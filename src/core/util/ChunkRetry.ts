import { system, LocationInUnloadedChunkError } from "@minecraft/server";
import type { Logger } from "../Logger";

/**
 * Right after world load, chunks around spawn aren't guaranteed to be
 * loaded/ticking yet - a script call that touches a specific location
 * there (spawnEntity, fillBlocks, ...) can throw
 * `LocationInUnloadedChunkError` in that narrow window. This retries
 * `action` on a short timer until that specific error stops, instead of
 * letting it propagate and abort whatever init pass called us. Any other
 * error is rethrown immediately, not retried.
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
