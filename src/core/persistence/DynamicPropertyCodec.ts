import type { Vector3 } from "@minecraft/server";
import { Logger } from "../Logger";

/**
 * Dynamic properties only store primitives (boolean/number/string/Vector3).
 * These helpers round-trip arbitrary JSON-serializable data through a
 * single string property - used for player-side components (currency,
 * owned kits, pending deliveries) and for the world-side rotating shop
 * state alike, since both `Player` and `World` implement this shape.
 */
export interface DynamicPropertyHolder {
  getDynamicProperty(identifier: string): boolean | number | string | Vector3 | undefined;
  setDynamicProperty(identifier: string, value?: boolean | number | string | Vector3): void;
}

const logger = new Logger("DynamicPropertyCodec");

export function readJson<T>(holder: DynamicPropertyHolder, key: string, fallback: T): T {
  const raw = holder.getDynamicProperty(key);
  if (typeof raw !== "string" || raw.length === 0) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    logger.warn(`Failed to parse dynamic property "${key}" - resetting to default.`, error);
    return fallback;
  }
}

export function writeJson<T>(holder: DynamicPropertyHolder, key: string, value: T): void {
  holder.setDynamicProperty(key, JSON.stringify(value));
}
