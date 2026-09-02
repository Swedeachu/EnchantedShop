import { world, BlockVolume, type Dimension } from "@minecraft/server";
import { Logger } from "../core/Logger";
import { GameConfig } from "../config/GameConfig";
import { retryOnUnloadedChunk } from "../core/util/ChunkRetry";

const BUILT_FLAG_KEY = "enchantedshop:hubPlatformBuilt";
const logger = new Logger("SpawnPlatform");

/**
 * Bedrock Dedicated Server has no server.properties equivalent of Java's
 * level-type=flat (confirmed against the official property reference -
 * "level-type" isn't a recognized BDS property at all, which is why setting
 * it never changed anything). The practical fix that doesn't require
 * hand-authoring a world on a client and uploading it: carve a flat
 * platform out of whatever terrain naturally generated at the hub spawn
 * point, once, the first time the world loads.
 *
 * Guarded by a world dynamic property so this never re-runs (and never
 * re-flattens over anything a player has since built) after the first time.
 */
export function ensureHubPlatformBuilt(dimension: Dimension): void {
  if (world.getDynamicProperty(BUILT_FLAG_KEY) === true) {
    return;
  }

  const { platform, spawnLocation } = GameConfig.hub;
  const centerX = Math.floor(spawnLocation.x);
  const centerZ = Math.floor(spawnLocation.z);
  const minX = centerX - platform.halfSize;
  const maxX = centerX + platform.halfSize;
  const minZ = centerZ - platform.halfSize;
  const maxZ = centerZ + platform.halfSize;
  // Players/Mister ShopMan stand at spawnLocation.y, so the top (grass)
  // layer is one below that - derived, not configured separately, so the
  // platform can never end up at a different height than spawnLocation.
  const grassY = Math.floor(spawnLocation.y) - 1;

  // Right after world load the spawn chunk isn't guaranteed to be ticking
  // yet (see ChunkRetry.ts) - fillBlocks can throw LocationInUnloadedChunkError
  // in that window, so the whole build retries rather than giving up after
  // one attempt and leaving spawn un-flattened until the next full restart.
  retryOnUnloadedChunk(
    () => {
      dimension.fillBlocks(
        new BlockVolume({ x: minX, y: grassY, z: minZ }, { x: maxX, y: grassY, z: maxZ }),
        "minecraft:grass_block",
        { ignoreChunkBoundErrors: true }
      );

      if (platform.dirtDepth > 0) {
        dimension.fillBlocks(
          new BlockVolume(
            { x: minX, y: grassY - platform.dirtDepth, z: minZ },
            { x: maxX, y: grassY - 1, z: maxZ }
          ),
          "minecraft:dirt",
          { ignoreChunkBoundErrors: true }
        );
      }

      if (platform.stoneDepth > 0) {
        const stoneBottom = grassY - platform.dirtDepth - platform.stoneDepth;
        dimension.fillBlocks(
          new BlockVolume(
            { x: minX, y: stoneBottom, z: minZ },
            { x: maxX, y: grassY - platform.dirtDepth - 1, z: maxZ }
          ),
          "minecraft:stone",
          { ignoreChunkBoundErrors: true }
        );
      }

      if (platform.airClearHeight > 0) {
        dimension.fillBlocks(
          new BlockVolume(
            { x: minX, y: grassY + 1, z: minZ },
            { x: maxX, y: grassY + platform.airClearHeight, z: maxZ }
          ),
          "minecraft:air",
          { ignoreChunkBoundErrors: true }
        );
      }

      world.setDynamicProperty(BUILT_FLAG_KEY, true);
      const width = maxX - minX + 1;
      logger.info(`Built flat hub platform (${width}x${width}) centered at (${centerX}, ${grassY}, ${centerZ}).`);
    },
    {
      logger,
      description: "Build hub platform"
    }
  );
}
