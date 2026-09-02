import { world } from "@minecraft/server";
import { GameSystem } from "../core/System";
import type { SystemManager } from "../core/SystemManager";
import { Logger } from "../core/Logger";
import { GameConfig } from "../config/GameConfig";
import { readJson, writeJson } from "../core/persistence/DynamicPropertyCodec";
import { STATIC_SHOP_ENTRIES } from "../shop/StaticShopConfig";
import { ROTATING_SHOP_ROTATIONS } from "../shop/RotatingShopConfig";
import type { RotatingShopRotation, ShopEntry } from "../shop/ShopTypes";

const DYNAMIC_PROPERTY_KEY = "enchantedshop:rotatingShopState";

/** A rotation's own durationMinutesOverride wins if set; otherwise the shop-wide default. */
function rotationDurationMs(rotation: RotatingShopRotation): number {
  const minutes = rotation.durationMinutesOverride ?? GameConfig.rotatingShop.rotationDurationMinutes;
  return minutes * 60_000;
}

interface RotatingShopState {
  rotationIndex: number;
  /** entry id -> remaining stock */
  stock: Record<string, number>;
  nextRotationAtEpochMs: number;
}

export interface ActiveRotatingEntry {
  readonly entry: ShopEntry;
  readonly maxStock: number;
  readonly remainingStock: number;
}

/**
 * Owns both shops' contents. The static shop is pure config (STATIC_SHOP_ENTRIES) -
 * nothing to persist. The rotating shop's *state* (which rotation is active,
 * remaining stock, when it next rotates) is runtime data, not config, so it
 * persists to a WORLD dynamic property and correctly catches up across a
 * server restart - including one that was down for multiple rotation periods.
 */
export class ShopSystem extends GameSystem {
  private readonly logger = new Logger("ShopSystem");
  private state: RotatingShopState;

  public constructor(manager: SystemManager) {
    super(manager);
    this.state = this.freshState(0);
  }

  public onInit(): void {
    if (ROTATING_SHOP_ROTATIONS.length === 0) {
      throw new Error("ROTATING_SHOP_ROTATIONS is empty - configure at least one rotation.");
    }

    const loaded = readJson<RotatingShopState | undefined>(world, DYNAMIC_PROPERTY_KEY, undefined);
    this.state = loaded ?? this.freshState(0);
    this.catchUpRotations();
    this.persist();

    const minutesLeft = Math.max(0, Math.round((this.state.nextRotationAtEpochMs - Date.now()) / 60_000));
    this.logger.info(
      `Rotating shop on rotation ${this.state.rotationIndex + 1}/${ROTATING_SHOP_ROTATIONS.length}, next rotation in ${minutesLeft} min.`
    );
  }

  public override onSecond(): void {
    if (Date.now() >= this.state.nextRotationAtEpochMs) {
      this.catchUpRotations();
      this.persist();
      this.logger.info(`Rotating shop advanced to rotation ${this.state.rotationIndex + 1}/${ROTATING_SHOP_ROTATIONS.length}.`);
    }
  }

  public getStaticEntries(): readonly ShopEntry[] {
    return STATIC_SHOP_ENTRIES;
  }

  public getActiveRotation(): RotatingShopRotation {
    const rotation = ROTATING_SHOP_ROTATIONS[this.state.rotationIndex];
    if (!rotation) {
      throw new Error(`Rotation index ${this.state.rotationIndex} is out of range.`);
    }
    return rotation;
  }

  public getActiveRotatingEntries(): ActiveRotatingEntry[] {
    return this.getActiveRotation().entries.map(({ entry, maxStock }) => ({
      entry,
      maxStock,
      remainingStock: this.state.stock[entry.id] ?? maxStock
    }));
  }

  public getMillisecondsUntilNextRotation(): number {
    return Math.max(0, this.state.nextRotationAtEpochMs - Date.now());
  }

  /** Remaining stock for a rotating-shop entry id, or undefined if it's not in the active rotation. */
  public getRemainingStock(entryId: string): number | undefined {
    const active = this.getActiveRotation().entries.find((candidate) => candidate.entry.id === entryId);
    if (!active) {
      return undefined;
    }
    return this.state.stock[entryId] ?? active.maxStock;
  }

  /** Decrements stock for a rotating-shop purchase. Returns false (no-op) if there isn't enough left. */
  public tryReserveStock(entryId: string, quantity: number): boolean {
    const remaining = this.getRemainingStock(entryId);
    if (remaining === undefined || remaining < quantity) {
      return false;
    }
    this.state.stock[entryId] = remaining - quantity;
    this.persist();
    return true;
  }

  /** Undoes a reservation (e.g. the currency charge that followed it failed). */
  public restoreStock(entryId: string, quantity: number): void {
    const remaining = this.getRemainingStock(entryId);
    if (remaining === undefined) {
      return;
    }
    this.state.stock[entryId] = remaining + quantity;
    this.persist();
  }

  private catchUpRotations(): void {
    // Advance rotation-by-rotation (not just once) so a server that was off
    // for a while lands on the rotation it should actually be on, with a
    // correctly recomputed "next rotation" timestamp - anchored to the old
    // schedule, not reset to "a full duration from right now".
    let safety = 0;
    while (Date.now() >= this.state.nextRotationAtEpochMs && safety < 10_000) {
      const nextIndex = (this.state.rotationIndex + 1) % ROTATING_SHOP_ROTATIONS.length;
      this.state = this.freshState(nextIndex, this.state.nextRotationAtEpochMs);
      safety++;
    }
  }

  private freshState(rotationIndex: number, fromEpochMs: number = Date.now()): RotatingShopState {
    const rotation = ROTATING_SHOP_ROTATIONS[rotationIndex];
    if (!rotation) {
      throw new Error(`Rotation index ${rotationIndex} is out of range.`);
    }

    const stock: Record<string, number> = {};
    for (const { entry, maxStock } of rotation.entries) {
      stock[entry.id] = maxStock;
    }

    return {
      rotationIndex,
      stock,
      nextRotationAtEpochMs: fromEpochMs + rotationDurationMs(rotation)
    };
  }

  private persist(): void {
    writeJson(world, DYNAMIC_PROPERTY_KEY, this.state);
  }
}
