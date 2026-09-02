import type { GameSystem } from "./System";
import type { SystemManager } from "./SystemManager";

export type SystemFactory<T extends GameSystem = GameSystem> = (manager: SystemManager) => T;

/**
 * Only matters for a system whose factory needs another system already
 * built off `manager` (e.g. CurrencySystem reading manager.getPlayerSystem()).
 * Most systems don't need this - Default puts them in the middle, after
 * First and before Last.
 */
export enum SystemOrder {
  First = -1000,
  Default = 0,
  Last = 1000
}

interface Registration {
  readonly factory: SystemFactory;
  readonly order: SystemOrder | number;
}

const registrations: Registration[] = [];

/**
 * One-line self-registration for a GameSystem: call this at the bottom of
 * the system's own file (see PlayerSystem.ts) and SystemManager builds and
 * wires it up automatically - no import, no field, no line to add inside
 * SystemManager itself.
 */
export function registerSystem<T extends GameSystem>(
  factory: SystemFactory<T>,
  order: SystemOrder | number = SystemOrder.Default
): void {
  registrations.push({ factory, order });
}

/** SystemManager-only: every self-registered factory, sorted into build order. */
export function getRegisteredSystemFactories(): readonly SystemFactory[] {
  return [...registrations].sort((a, b) => a.order - b.order).map((registration) => registration.factory);
}
