/**
 * Icon shown on a category button in the shop's category menu, keyed by
 * the exact category label string (kit categories use KIT_CATEGORY_LABEL's
 * values, generic-item categories are whatever StaticShopConfig/
 * RotatingShopConfig hand-write - both land here as plain strings). Falls
 * back to a generic "shop" icon for anything not explicitly listed, so a
 * new category never ends up with a missing/blank icon.
 */
const CATEGORY_ICON_PATHS: Readonly<Record<string, string>> = {
  "Starter Kits": "textures/items/wood_sword",
  "PvP Kits": "textures/items/diamond_sword",
  "Archer Kits": "textures/items/bow_standby",
  Food: "textures/items/apple_golden",
  Utility: "textures/items/ender_pearl",
  Featured: "textures/items/clock_item"
};

const DEFAULT_CATEGORY_ICON_PATH = "textures/items/emerald";

export function getCategoryIconPath(category: string): string {
  return CATEGORY_ICON_PATHS[category] ?? DEFAULT_CATEGORY_ICON_PATH;
}
