import { MinecraftItemTypes, MinecraftEnchantmentTypes } from "@minecraft/vanilla-data";
import { KitCategory, type KitDefinition } from "./KitTypes";

/**
 * Every kit sold anywhere in the shop is defined here, once, grouped into
 * categories. Both StaticShopConfig and RotatingShopConfig reference kits
 * by id from this list rather than duplicating their contents - this is the
 * "kits load into the shop automatically from config" piece.
 */
export const KITS_CONFIG: readonly KitDefinition[] = [
  {
    id: "starter_wood",
    displayName: "Wooden Starter Kit",
    category: KitCategory.Starter,
    description: "Basic starter gear.",
    price: 25,
    contents: [
      { itemId: MinecraftItemTypes.WoodenSword, amount: 1 },
      { itemId: MinecraftItemTypes.LeatherChestplate, amount: 1 },
      { itemId: MinecraftItemTypes.Bread, amount: 8 }
    ]
  },
  {
    id: "pvp_iron",
    displayName: "Iron Kit",
    category: KitCategory.PvP,
    description: "Enchanted mid-tier gear.",
    price: 250,
    contents: [
      {
        itemId: MinecraftItemTypes.IronSword,
        amount: 1,
        enchantments: [{ id: MinecraftEnchantmentTypes.Sharpness, level: 1 }]
      },
      {
        itemId: MinecraftItemTypes.IronHelmet,
        amount: 1,
        enchantments: [{ id: MinecraftEnchantmentTypes.Protection, level: 1 }]
      },
      {
        itemId: MinecraftItemTypes.IronChestplate,
        amount: 1,
        enchantments: [{ id: MinecraftEnchantmentTypes.Protection, level: 1 }]
      },
      {
        itemId: MinecraftItemTypes.IronLeggings,
        amount: 1,
        enchantments: [{ id: MinecraftEnchantmentTypes.Protection, level: 1 }]
      },
      {
        itemId: MinecraftItemTypes.IronBoots,
        amount: 1,
        enchantments: [{ id: MinecraftEnchantmentTypes.Protection, level: 1 }]
      },
      { itemId: MinecraftItemTypes.GoldenApple, amount: 4 }
    ]
  },
  {
    id: "pvp_diamond",
    displayName: "Diamond Kit",
    category: KitCategory.PvP,
    description: "Top-tier dueling gear.",
    price: 750,
    contents: [
      {
        itemId: MinecraftItemTypes.DiamondSword,
        amount: 1,
        enchantments: [
          { id: MinecraftEnchantmentTypes.Sharpness, level: 2 },
          { id: MinecraftEnchantmentTypes.Unbreaking, level: 2 }
        ]
      },
      {
        itemId: MinecraftItemTypes.DiamondHelmet,
        amount: 1,
        enchantments: [{ id: MinecraftEnchantmentTypes.Protection, level: 2 }]
      },
      {
        itemId: MinecraftItemTypes.DiamondChestplate,
        amount: 1,
        enchantments: [{ id: MinecraftEnchantmentTypes.Protection, level: 2 }]
      },
      {
        itemId: MinecraftItemTypes.DiamondLeggings,
        amount: 1,
        enchantments: [{ id: MinecraftEnchantmentTypes.Protection, level: 2 }]
      },
      {
        itemId: MinecraftItemTypes.DiamondBoots,
        amount: 1,
        enchantments: [
          { id: MinecraftEnchantmentTypes.Protection, level: 2 },
          { id: MinecraftEnchantmentTypes.FeatherFalling, level: 2 }
        ]
      },
      { itemId: MinecraftItemTypes.GoldenApple, amount: 8 }
    ]
  },
  {
    id: "archer_basic",
    displayName: "Archer Kit",
    category: KitCategory.Archer,
    description: "Enchanted ranged loadout.",
    price: 300,
    contents: [
      {
        itemId: MinecraftItemTypes.Bow,
        amount: 1,
        enchantments: [
          { id: MinecraftEnchantmentTypes.Power, level: 2 },
          { id: MinecraftEnchantmentTypes.Punch, level: 1 }
        ]
      },
      { itemId: MinecraftItemTypes.Arrow, amount: 64 },
      {
        itemId: MinecraftItemTypes.LeatherBoots,
        amount: 1,
        enchantments: [{ id: MinecraftEnchantmentTypes.FeatherFalling, level: 1 }]
      }
    ]
  }
];
