import type { Vector3 } from "@minecraft/server";

/**
 * Every script-side tunable for the shop system lives here. Nothing in this
 * file is persisted - it ships with the pack and changes on the next build,
 * unlike player balances / owned kits / rotating stock, which live in
 * dynamic properties (see src/core/persistence/DynamicPropertyCodec.ts).
 */
export const GameConfig = {
  currency: {
    /** Display name used in chat messages and the shop UI. */
    name: "Coins",
    /** Balance a brand-new player starts with. */
    startingBalance: 100
  },

  shopMan: {
    dimensionId: "overworld",
    /**
     * Where Mister ShopMan is spawned, and permanently anchored to (he's a
     * stationary "ghost" NPC - see EntitySystem / stationaryBehavior -
     * so this is also where he'll always be found, exactly).
     */
    spawnLocation: { x: 0, y: 70, z: 16 } as Vector3,
    nameTag: "§6Mister ShopMan",
    /** Identifies "the" shop NPC among any other villagers that might exist. */
    tag: "enchantedshop:shopman"
  },

  rotatingShop: {
    /** How often the limited-time shop rotates to its next stock, in real minutes. */
    rotationDurationMinutes: 60
  },

  delivery: {
    /**
     * How often (in ticks, ~20/s) DeliverySystem retries handing out queued
     * items to players whose inventory was full at purchase time. Deliberately
     * decoupled from autosaveIntervalSeconds below - a full inventory should
     * drain almost the instant space frees up, not wait up to a minute for it,
     * and DeliverySystem already early-outs in O(1) whenever nobody has
     * anything queued, so a short interval here costs nothing in the common case.
     */
    retryIntervalTicks: 5
  },

  hub: {
    dimensionId: "overworld",
    /** Where players land when LoadingScene hands them off into HubScene - also the world's default spawn point. */
    spawnLocation: { x: 0, y: 70, z: 20 } as Vector3,

    /**
     * A flat platform carved out of whatever terrain naturally generates at
     * spawnLocation, since Bedrock Dedicated Server has no server.properties
     * equivalent of Java's level-type=flat (see README's "Flat world" note) -
     * built once, on first HubScene.init(), and never touched again. The top
     * (grass) layer is always spawnLocation.y - 1 (see SpawnPlatform.ts), so
     * moving spawnLocation.y alone is enough to relocate the whole platform.
     */
    platform: {
      /** Half-width in blocks - the built footprint is (2*halfSize+1) square. */
      halfSize: 16,
      /** How many layers of dirt sit under the grass. */
      dirtDepth: 3,
      /** How many layers of stone sit under the dirt. */
      stoneDepth: 4,
      /** How much air is cleared above the grass layer for headroom / to remove overhanging terrain. */
      airClearHeight: 15
    },

    scoreboard: {
      objectiveId: "enchantedshop_currency",
      displayName: "§6Coins"
    }
  },

  /** How often (in real seconds) systems defensively re-persist online players' state. */
  autosaveIntervalSeconds: 60
} as const;
