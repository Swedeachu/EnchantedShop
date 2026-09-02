import { ItemStack, ItemComponentTypes, EnchantmentTypes, type ItemEnchantableComponent } from "@minecraft/server";
import { Logger } from "../core/Logger";

const logger = new Logger("ItemFactory");

export interface EnchantmentDefinition {
  /** Namespaced enchantment id, e.g. "minecraft:sharpness" - see MinecraftEnchantmentTypes from @minecraft/vanilla-data. */
  readonly id: string;
  readonly level: number;
}

export interface ItemDefinition {
  /** Namespaced item id, e.g. "minecraft:diamond_sword" - see MinecraftItemTypes from @minecraft/vanilla-data. */
  readonly itemId: string;
  readonly amount: number;
  readonly enchantments?: readonly EnchantmentDefinition[];
  readonly nameTag?: string;
  readonly loreLines?: readonly string[];
}

/**
 * Builds however many ItemStacks are needed to deliver `amount` copies of
 * `definition`, without silently losing items to the engine clamping a
 * single stack's amount down to the item's real max stack size - e.g. 5x a
 * kit containing 20 arrows is 100 arrows: two stacks of an item whose max
 * is 64, not one stack quietly clamped down to 64 and 36 arrows vanishing.
 */
export function createItemStacks(definition: ItemDefinition): ItemStack[] {
  const stacks: ItemStack[] = [];
  let remaining = Math.max(0, Math.floor(definition.amount));

  while (remaining > 0) {
    const stack = new ItemStack(definition.itemId, 1);
    const chunk = Math.min(remaining, stack.maxAmount);
    stack.amount = chunk;
    applyDefinition(stack, definition);
    stacks.push(stack);
    remaining -= chunk;
  }

  return stacks;
}

/** Convenience for the common case of a purchase that fits in a single stack. */
export function createItemStack(definition: ItemDefinition): ItemStack {
  const [stack] = createItemStacks(definition);
  if (!stack) {
    throw new Error(`createItemStack("${definition.itemId}") produced no stacks (amount was ${definition.amount}).`);
  }
  return stack;
}

/** The inverse of createItemStacks - used to persist a leftover/undelivered ItemStack as an ItemDefinition. */
export function itemStackToDefinition(stack: ItemStack): ItemDefinition {
  const enchantable = stack.getComponent(ItemComponentTypes.Enchantable) as ItemEnchantableComponent | undefined;
  const enchantments = enchantable
    ?.getEnchantments()
    .map((enchantment): EnchantmentDefinition => ({ id: enchantment.type.id, level: enchantment.level }));

  const lore = stack.getLore().filter((line): line is string => typeof line === "string");

  return {
    itemId: stack.typeId,
    amount: stack.amount,
    enchantments: enchantments && enchantments.length > 0 ? enchantments : undefined,
    nameTag: stack.nameTag,
    loreLines: lore.length > 0 ? lore : undefined
  };
}

function applyDefinition(stack: ItemStack, definition: ItemDefinition): void {
  if (definition.enchantments && definition.enchantments.length > 0) {
    const enchantable = stack.getComponent(ItemComponentTypes.Enchantable) as ItemEnchantableComponent | undefined;
    if (!enchantable) {
      logger.warn(`"${definition.itemId}" is not enchantable - ignoring configured enchantments.`);
    } else {
      for (const { id, level } of definition.enchantments) {
        const type = EnchantmentTypes.get(id);
        if (!type) {
          logger.warn(`Unknown enchantment id "${id}" - skipping.`);
          continue;
        }
        try {
          enchantable.addEnchantment({ type, level });
        } catch (error) {
          logger.warn(`Failed to add enchantment "${id}" x${level} to "${definition.itemId}".`, error);
        }
      }
    }
  }

  if (definition.nameTag) {
    stack.nameTag = definition.nameTag;
  }
  if (definition.loreLines && definition.loreLines.length > 0) {
    stack.setLore([...definition.loreLines]);
  }
}
