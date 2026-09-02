import { world, TimeOfDay } from "@minecraft/server";
import { Logger } from "../core/Logger";

const logger = new Logger("WorldSettings");

/**
 * Locks the world clock at noon: disables the day/night cycle gamerule
 * (so nothing advances it - a command, a sleeping player, etc.) and sets
 * the time once. A PvP lobby doesn't need a day cycle, and it keeps
 * lighting/visibility consistent for everyone.
 */
export function lockTimeAtNoon(): void {
  world.gameRules.doDayLightCycle = false;
  world.setTimeOfDay(TimeOfDay.Noon);
  logger.info("Time locked at noon (doDayLightCycle disabled).");
}
