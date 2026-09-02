/**
 * Maps a namespaced item id to a vanilla resource pack icon path usable
 * directly as ActionFormData.button()'s iconPath - no resource pack of our
 * own needed, since form icons resolve against the vanilla resource pack
 * that's always active client-side (confirmed against Mojang's own
 * bedrock-samples item_texture.json/terrain_texture.json).
 *
 * Most item ids match their texture key 1:1 once the "minecraft:" prefix
 * is stripped (e.g. "minecraft:diamond_sword" -> "textures/items/diamond_sword"),
 * but a handful of vanilla texture files are named differently from the
 * item id - those are the only entries that need to be listed explicitly.
 */
const ICON_OVERRIDES: Readonly<Record<string, string>> = {
  "minecraft:golden_apple": "textures/items/apple_golden",
  "minecraft:cooked_beef": "textures/items/beef_cooked",
  "minecraft:wooden_sword": "textures/items/wood_sword",
  "minecraft:bow": "textures/items/bow_standby",
  "minecraft:totem_of_undying": "textures/items/totem"
};

export function getItemIconPath(itemId: string): string {
  const override = ICON_OVERRIDES[itemId];
  if (override) {
    return override;
  }
  const shortId = itemId.includes(":") ? (itemId.split(":")[1] ?? itemId) : itemId;
  return `textures/items/${shortId}`;
}
