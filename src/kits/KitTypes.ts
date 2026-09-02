import type { ItemDefinition } from "../items/ItemFactory";

/** Categories kits load into automatically, driven entirely by KITS_CONFIG (see KitsConfig.ts). */
export enum KitCategory {
  Starter = "starter",
  PvP = "pvp",
  Archer = "archer"
}

export const KIT_CATEGORY_LABEL: Readonly<Record<KitCategory, string>> = {
  [KitCategory.Starter]: "Starter Kits",
  [KitCategory.PvP]: "PvP Kits",
  [KitCategory.Archer]: "Archer Kits"
};

export interface KitDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly category: KitCategory;
  readonly description: string;
  readonly price: number;
  readonly contents: readonly ItemDefinition[];
}
