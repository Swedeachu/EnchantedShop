import { GameConfig } from "../config/GameConfig";
import type { EnchantmentDefinition, ItemDefinition } from "../items/ItemFactory";
import type { KitDefinition } from "../kits/KitTypes";
import { getItemIconPath } from "../items/ItemIcons";
import { ShopEntryKind, type ShopEntry } from "./ShopTypes";

const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"] as const;

export function toRomanNumeral(level: number): string {
  return ROMAN_NUMERALS[level - 1] ?? String(level);
}

/** "minecraft:feather_falling" -> "Feather Falling". Used for anything without an explicit display name. */
export function humanizeId(id: string): string {
  const withoutNamespace = id.includes(":") ? (id.split(":")[1] ?? id) : id;
  return withoutNamespace
    .split("_")
    .filter((word) => word.length > 0)
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatEnchantment(enchantment: EnchantmentDefinition): string {
  return `${humanizeId(enchantment.id)} ${toRomanNumeral(enchantment.level)}`;
}

export function formatEnchantmentList(list: readonly EnchantmentDefinition[] | undefined): string {
  if (!list || list.length === 0) {
    return "";
  }
  return list.map(formatEnchantment).join(", ");
}

export function formatCurrency(amount: number): string {
  return `${amount} ${GameConfig.currency.name}`;
}

/**
 * One line describing a single item definition - name, quantity, and its
 * enchants/tier spelled out (dark aqua name, dark green enchant list) so
 * they're never just implied by a kit's name.
 */
export function formatItemDefinitionLine(definition: ItemDefinition): string {
  const name = definition.nameTag ?? humanizeId(definition.itemId);
  const enchants = formatEnchantmentList(definition.enchantments);
  const amountPrefix = definition.amount > 1 ? `${definition.amount}x ` : "";
  return enchants ? `§3${amountPrefix}${name} §2(${enchants})` : `§3${amountPrefix}${name}`;
}

/**
 * One bulleted line per item a kit contains - shared by describeShopEntry
 * (the shop's entry-list button) and the purchase form (see ShopUI.ts),
 * so both places spell out exactly what's inside instead of leaving it
 * implied by the kit's name.
 */
export function formatKitContentsLines(kit: KitDefinition): string[] {
  return kit.contents.map((item) => `§2 • ${formatItemDefinitionLine(item)}`);
}

/**
 * The full multi-line label shown on a shop entry's button - this is what
 * satisfies "enchants/tiers must be clearly displayed, not just implied by
 * the kit name": every enchanted item in a kit is spelled out by name and
 * level right here, not left for the player to infer. Kept to dark green
 * (§2) and dark aqua (§3) throughout, on purpose.
 */
export function describeShopEntry(entry: ShopEntry, options?: { readonly stock?: number }): string {
  const name = entry.kind === ShopEntryKind.Kit ? entry.kit.displayName : entry.displayName;
  const lines: string[] = [`§l${name}§r §2- §3${formatCurrency(entry.price)}`];

  if (options?.stock !== undefined) {
    lines.push(`§2Stock left: §3${options.stock}`);
  }

  if (entry.kind === ShopEntryKind.Kit) {
    lines.push(`§2${entry.kit.description}`);
    lines.push(...formatKitContentsLines(entry.kit));
  } else {
    const enchants = formatEnchantmentList(entry.item.enchantments);
    if (enchants) {
      lines.push(`§2(${enchants})`);
    }
  }

  return lines.join("\n");
}

/**
 * The icon shown on a shop entry's own button: a kit shows its first
 * content item's icon (the item a player would recognize the kit by), a
 * generic item shows its own icon.
 */
export function getShopEntryIconPath(entry: ShopEntry): string {
  if (entry.kind === ShopEntryKind.Kit) {
    const [firstItem] = entry.kit.contents;
    return getItemIconPath(firstItem?.itemId ?? "minecraft:emerald");
  }
  return getItemIconPath(entry.item.itemId);
}
