import type { NpcBehavior, SpawnedNpc } from "../NpcTypes";

/**
 * Fires one or more vanilla entity events once, right after the NPC
 * (re)spawns - e.g. forcing a villager's profession purely for its visual
 * appearance (see ShopManNpc.ts), without needing a real job site block.
 */
export function triggerEventsOnAttach(...eventIds: readonly string[]): NpcBehavior {
  return {
    onAttach: (npc: SpawnedNpc) => {
      const entity = npc.entity;
      if (!entity || !entity.isValid) {
        return;
      }
      for (const eventId of eventIds) {
        entity.triggerEvent(eventId);
      }
    }
  };
}
