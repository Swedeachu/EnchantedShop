import { LocationInUnloadedChunkError, type Vector3 } from "@minecraft/server";
import { MinecraftEffectTypes } from "@minecraft/vanilla-data";
import type { NpcBehavior, SpawnedNpc } from "../NpcTypes";

/** How often (in ticks) the Slowness/Resistance effects are refreshed - well inside EFFECT_DURATION_TICKS so they never actually lapse. */
const REAPPLY_EFFECTS_INTERVAL_TICKS = 100; // 5 seconds
/** How long each application lasts - just needs to comfortably outlast REAPPLY_EFFECTS_INTERVAL_TICKS. */
const EFFECT_DURATION_TICKS = 200; // 10 seconds
/** High enough that movement speed is effectively zero. */
const SLOWNESS_AMPLIFIER = 250;
/** Resistance V (amplifier 4) already negates ~100% of combat damage in vanilla; a little headroom. */
const RESISTANCE_AMPLIFIER = 5;
/** Squared distance (blocks) tolerated before snapping back - guards against float noise, not real drift. */
const DRIFT_EPSILON_SQUARED = 0.0004; // ~0.02 blocks

/**
 * Makes an NPC into a stationary "ghost": permanently anchored to `home`
 * and immune to knockback/damage, so punching or crowding it never moves
 * it. Two layers, since neither alone is airtight:
 *  - Slowness + Resistance stop it from walking on its own and stop
 *    combat damage/knockback from registering in the first place.
 *  - A hard teleport-back-to-home check every tick catches anything that
 *    still nudges it a hair (e.g. physics on the exact tick a hit lands),
 *    so it never visibly drifts even for a moment.
 */
export function stationaryBehavior(home: Vector3): NpcBehavior {
  const applyEffects = (npc: SpawnedNpc): void => {
    const entity = npc.entity;
    if (!entity || !entity.isValid) {
      return;
    }
    entity.addEffect(MinecraftEffectTypes.Slowness, EFFECT_DURATION_TICKS, {
      amplifier: SLOWNESS_AMPLIFIER,
      showParticles: false
    });
    entity.addEffect(MinecraftEffectTypes.Resistance, EFFECT_DURATION_TICKS, {
      amplifier: RESISTANCE_AMPLIFIER,
      showParticles: false
    });
  };

  return {
    onAttach: (npc) => applyEffects(npc),

    onTick: (npc, currentTick) => {
      const entity = npc.entity;
      if (!entity || !entity.isValid) {
        return;
      }

      const at = entity.location;
      const dx = at.x - home.x;
      const dy = at.y - home.y;
      const dz = at.z - home.z;
      if (dx * dx + dy * dy + dz * dz > DRIFT_EPSILON_SQUARED) {
        try {
          entity.teleport(home);
        } catch (error) {
          // The chunk can briefly be unloaded again (e.g. every player
          // stepped away) - harmless, next tick's check just retries.
          if (!(error instanceof LocationInUnloadedChunkError)) {
            throw error;
          }
        }
      }

      if (currentTick % REAPPLY_EFFECTS_INTERVAL_TICKS === 0) {
        applyEffects(npc);
      }
    }
  };
}
