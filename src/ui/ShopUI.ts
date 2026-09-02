import type { Player } from "@minecraft/server";
import { ActionFormData, CustomForm, ObservableNumber, ObservableString } from "@minecraft/server-ui";
import { Logger } from "../core/Logger";
import { ShopEntryKind, type ShopEntry } from "../shop/ShopTypes";
import {
  describeShopEntry,
  formatCurrency,
  formatKitContentsLines,
  getShopEntryIconPath,
  humanizeId
} from "../shop/ShopFormatting";
import { getCategoryIconPath } from "../shop/ShopCategoryIcons";
import { showToast } from "./ToastNotification";
import type { ActiveRotatingEntry, ShopSystem } from "../systems/ShopSystem";
import type { KitsSystem } from "../systems/KitsSystem";
import type { CurrencySystem } from "../systems/CurrencySystem";
import type { DeliverySystem } from "../systems/DeliverySystem";

const logger = new Logger("ShopUI");

export interface ShopUIContext {
  readonly shopSystem: ShopSystem;
  readonly kitsSystem: KitsSystem;
  readonly currencySystem: CurrencySystem;
  readonly deliverySystem: DeliverySystem;
}

// Vanilla resource pack icon paths - resolve without a resource pack of
// our own (see src/items/ItemIcons.ts for how per-item icons are derived).
const SHOP_ICON = "textures/items/emerald";
const ROTATING_SHOP_ICON = "textures/items/clock_item";
const CLOSE_ICON = "textures/blocks/barrier";
// The vanilla UI atlas icon used for every "Back"/"Previous" button.
const BACK_ICON = "textures/ui/arrow_left";
const CANCEL_ICON = "textures/blocks/barrier";

enum ShopKind {
  Static,
  Rotating
}

interface ListedEntry {
  readonly entry: ShopEntry;
  readonly remainingStock?: number;
}

/** Entry point - called by OpenShopBehavior (EntitySystem) on interact or hit. */
export async function openShopMenu(player: Player, ctx: ShopUIContext): Promise<void> {
  const balance = ctx.currencySystem.getBalance(player.id);
  const minutesLeft = Math.ceil(ctx.shopSystem.getMillisecondsUntilNextRotation() / 60_000);

  const form = new ActionFormData()
    .title("Mister ShopMan")
    .body(`§7Balance: §a${formatCurrency(balance)}\n§7Limited-time shop rotates in §e${minutesLeft} min`)
    .button("§2§lShop", SHOP_ICON)
    .button(`§3§lLimited-Time Shop§r\n§e${minutesLeft} min left`, ROTATING_SHOP_ICON)
    .button("§4Close", CLOSE_ICON);

  const response = await form.show(player);
  const { canceled, selection } = response;
  if (canceled || selection === undefined || selection === 2) {
    return;
  }

  await openCategoryMenu(player, ctx, selection === 0 ? ShopKind.Static : ShopKind.Rotating);
}

function collectEntries(ctx: ShopUIContext, kind: ShopKind): ListedEntry[] {
  if (kind === ShopKind.Static) {
    return ctx.shopSystem.getStaticEntries().map((entry) => ({ entry }));
  }
  return ctx.shopSystem.getActiveRotatingEntries().map(
    (active: ActiveRotatingEntry): ListedEntry => ({
      entry: active.entry,
      remainingStock: active.remainingStock
    })
  );
}

async function openCategoryMenu(player: Player, ctx: ShopUIContext, kind: ShopKind): Promise<void> {
  const entries = collectEntries(ctx, kind);
  const categories = [...new Set(entries.map((listed) => listed.entry.category))];

  const form = new ActionFormData().title(kind === ShopKind.Static ? "Shop" : "Limited-Time Shop");
  for (const category of categories) {
    form.button(category, getCategoryIconPath(category));
  }
  form.button("Back", BACK_ICON);

  const response = await form.show(player);
  const { canceled, selection } = response;
  if (canceled || selection === undefined) {
    return;
  }
  if (selection >= categories.length) {
    return openShopMenu(player, ctx);
  }

  const category = categories[selection];
  if (category === undefined) {
    return;
  }
  await openEntryListMenu(player, ctx, kind, category, entries.filter((listed) => listed.entry.category === category));
}

async function openEntryListMenu(
  player: Player,
  ctx: ShopUIContext,
  kind: ShopKind,
  category: string,
  entries: readonly ListedEntry[]
): Promise<void> {
  const form = new ActionFormData().title(category);
  for (const listed of entries) {
    form.button(describeShopEntry(listed.entry, { stock: listed.remainingStock }), getShopEntryIconPath(listed.entry));
  }
  form.button("Back", BACK_ICON);

  const response = await form.show(player);
  const { canceled, selection } = response;
  if (canceled || selection === undefined) {
    return;
  }
  if (selection >= entries.length) {
    return openCategoryMenu(player, ctx, kind);
  }

  const chosen = entries[selection];
  if (!chosen) {
    return;
  }
  await openPurchaseMenu(player, ctx, kind, chosen.entry);
}

function computeMaxQuantity(ctx: ShopUIContext, playerId: string, kind: ShopKind, entry: ShopEntry): number {
  const balance = ctx.currencySystem.getBalance(playerId);
  const stockCap = kind === ShopKind.Rotating ? (ctx.shopSystem.getRemainingStock(entry.id) ?? 0) : Number.POSITIVE_INFINITY;
  const affordableCap = entry.price > 0 ? Math.floor(balance / entry.price) : 64;
  return Math.max(0, Math.min(affordableCap, stockCap, 64));
}

/** Everything the purchase screens need about the entry, computed once up front. */
interface PurchaseContext {
  readonly name: string;
  readonly iconPath: string;
  readonly contentsLines: readonly string[];
}

function buildPurchaseContext(entry: ShopEntry): PurchaseContext {
  return {
    name: entry.kind === ShopEntryKind.Kit ? entry.kit.displayName : entry.displayName,
    iconPath: getShopEntryIconPath(entry),
    contentsLines: entry.kind === ShopEntryKind.Kit ? formatKitContentsLines(entry.kit) : []
  };
}

async function openPurchaseMenu(player: Player, ctx: ShopUIContext, kind: ShopKind, entry: ShopEntry): Promise<void> {
  const maxQuantity = computeMaxQuantity(ctx, player.id, kind, entry);

  if (maxQuantity < 1) {
    player.sendMessage(
      kind === ShopKind.Rotating
        ? "§cYou can't afford that right now, or it's out of stock."
        : "§cYou can't afford that right now."
    );
    return;
  }

  const purchase = buildPurchaseContext(entry);

  // A slider needs a max strictly greater than its min, so it can't
  // represent "the max the player can afford is exactly 1" - the slider
  // max must still track affordability exactly (never a stand-in value
  // like 64), so when it's 1 this skips the slider for a plain
  // confirmation instead of showing a misleading 1-2 range.
  if (maxQuantity === 1) {
    await confirmSingleQuantityPurchase(player, ctx, kind, entry, purchase);
    return;
  }

  await openQuantitySliderMenu(player, ctx, kind, entry, purchase, maxQuantity);
}

/**
 * The item/kit the player is buying, its contents (for a kit - see
 * formatKitContentsLines), and a quantity slider whose label text updates
 * live as it's dragged with both the running total cost and (for a kit)
 * the total amount of each content item at the selected quantity - all via
 * CustomForm's ObservableNumber/ObservableString reactive binding, not a
 * static "Quantity" label the way ModalFormData's slider is stuck with.
 */
async function openQuantitySliderMenu(
  player: Player,
  ctx: ShopUIContext,
  kind: ShopKind,
  entry: ShopEntry,
  purchase: PurchaseContext,
  maxQuantity: number
): Promise<void> {
  const quantity = new ObservableNumber(1, { clientWritable: true });
  const quantityLabel = new ObservableString(describeQuantitySelection(entry, purchase, 1));

  quantity.subscribe((value) => {
    quantityLabel.setData(describeQuantitySelection(entry, purchase, Math.round(value)));
  });

  let confirmed = false;

  const form = new CustomForm(player, purchase.name)
    .label(new ObservableString(purchase.contentsLines.length > 0 ? purchase.contentsLines.join("\n") : ""))
    .slider("Quantity", quantity, 1, maxQuantity, { step: 1 })
    .label(quantityLabel)
    // Plain, uncoded labels on purpose: CustomForm buttons render as flat
    // system UI (see Microsoft's own CustomForm reference/examples) and
    // don't respect section-sign color codes the way ActionFormData's do -
    // a code left in just prints literally ("§2Purchase") instead of
    // coloring the text.
    .button("Purchase", () => {
      confirmed = true;
      form.close();
    })
    .button("Cancel", () => {
      form.close();
    });

  await form.show();

  if (!confirmed) {
    return;
  }

  const requested = Math.round(quantity.getData());
  await completePurchase(player, ctx, kind, entry, requested, maxQuantity);
}

/** "Quantity: 3 (180 Coins) - Iron Sword, 3x Golden Apple, ..." style live label for the slider. */
function describeQuantitySelection(entry: ShopEntry, purchase: PurchaseContext, quantity: number): string {
  const totalCost = formatCurrency(entry.price * quantity);
  const lines = [`§2Quantity: §3${quantity} §2(§3${totalCost}§2)`];

  if (entry.kind === ShopEntryKind.Kit) {
    for (const item of entry.kit.contents) {
      const totalAmount = item.amount * quantity;
      const label = item.nameTag ?? humanizeId(item.itemId);
      lines.push(`§2 • §3${totalAmount}x ${label}`);
    }
  }

  return lines.join("\n");
}

async function confirmSingleQuantityPurchase(
  player: Player,
  ctx: ShopUIContext,
  kind: ShopKind,
  entry: ShopEntry,
  purchase: PurchaseContext
): Promise<void> {
  const bodyLines = [`§2Are you sure you want to buy §3${purchase.name}§2 for §3${formatCurrency(entry.price)}§2?`];
  if (purchase.contentsLines.length > 0) {
    bodyLines.push("", ...purchase.contentsLines);
  }

  const form = new ActionFormData()
    .title(purchase.name)
    .body(bodyLines.join("\n"))
    .button(`§2Buy ${purchase.name}`, purchase.iconPath)
    .button("§4Cancel", CANCEL_ICON);

  const response = await form.show(player);
  if (response.canceled || response.selection !== 0) {
    return;
  }

  await completePurchase(player, ctx, kind, entry, 1, 1);
}

async function completePurchase(
  player: Player,
  ctx: ShopUIContext,
  kind: ShopKind,
  entry: ShopEntry,
  requestedQuantity: number,
  uiComputedMax: number
): Promise<void> {
  // Re-validate against live state rather than trusting the slider bound -
  // balance/stock may have changed in the moment the form was open.
  const liveMax = computeMaxQuantity(ctx, player.id, kind, entry);
  const quantity = Math.max(0, Math.min(requestedQuantity, uiComputedMax, liveMax));

  if (quantity < 1) {
    player.sendMessage("§cThat's no longer available - your balance or the remaining stock changed.");
    return;
  }

  const totalCost = entry.price * quantity;

  if (kind === ShopKind.Rotating && !ctx.shopSystem.tryReserveStock(entry.id, quantity)) {
    player.sendMessage("§cSomeone just bought the last of that - try again.");
    return;
  }

  if (!ctx.currencySystem.charge(player, totalCost)) {
    if (kind === ShopKind.Rotating) {
      ctx.shopSystem.restoreStock(entry.id, quantity);
    }
    player.sendMessage("§cYou can't afford that.");
    return;
  }

  const definitions =
    entry.kind === ShopEntryKind.Kit
      ? entry.kit.contents.map((item) => ({ ...item, amount: item.amount * quantity }))
      : [{ ...entry.item, amount: entry.item.amount * quantity }];

  ctx.deliverySystem.deliver(player, definitions);

  if (entry.kind === ShopEntryKind.Kit) {
    ctx.kitsSystem.recordPurchase(player, entry.kit.id, quantity);
  }

  const name = entry.kind === ShopEntryKind.Kit ? entry.kit.displayName : entry.displayName;
  const summary = `Purchased ${quantity}x ${name} for ${formatCurrency(totalCost)}.`;
  player.sendMessage(`§a${summary}`);
  showToast(player, `§a✔ ${summary}`);
  logger.info(`${player.name} bought ${quantity}x ${entry.id} for ${totalCost}.`);
}
