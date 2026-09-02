import {
  CommandPermissionLevel,
  CustomCommandParamType,
  CustomCommandStatus,
  type CustomCommandRegistry,
  type CustomCommandResult,
  type Player
} from "@minecraft/server";
import { SystemManager } from "../core/SystemManager";
import { Logger } from "../core/Logger";
import { formatCurrency } from "../shop/ShopFormatting";

const logger = new Logger("MoneyCommand");

/**
 * Registers `/enchantedshop:money <player> <amount>` - Bedrock's Custom
 * Commands API requires every command name to carry a namespace, so there
 * is no way to expose a bare `/money`; this is the closest equivalent.
 *
 * Must be called from `system.beforeEvents.startup` (see main.ts) - the
 * registry is only writable during early-execution, well before the world
 * (and SystemManager) exist, so the callback below reaches CurrencySystem
 * lazily via `SystemManager.get()` at call time instead of capturing it
 * up front.
 */
export function registerMoneyCommand(registry: CustomCommandRegistry): void {
  registry.registerCommand(
    {
      name: "enchantedshop:money",
      description: "Grants Coins to one or more players.",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      cheatsRequired: true,
      mandatoryParameters: [
        { name: "targets", type: CustomCommandParamType.PlayerSelector },
        { name: "amount", type: CustomCommandParamType.Integer }
      ]
    },
    (_origin, ...args): CustomCommandResult => handleMoneyCommand(args[0] as Player[], args[1] as number)
  );
}

function handleMoneyCommand(targets: Player[] | undefined, amount: number): CustomCommandResult {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { status: CustomCommandStatus.Failure, message: "§cAmount must be a positive whole number." };
  }
  if (!targets || targets.length === 0) {
    return { status: CustomCommandStatus.Failure, message: "§cNo matching player(s) found." };
  }

  const roundedAmount = Math.floor(amount);
  const currencySystem = SystemManager.get().getCurrencySystem();

  for (const target of targets) {
    currencySystem.grant(target, roundedAmount);
    target.sendMessage(`§aYou received ${formatCurrency(roundedAmount)}!`);
  }

  const names = targets.map((target) => target.name).join(", ");
  logger.info(`Granted ${formatCurrency(roundedAmount)} to: ${names}`);
  return { status: CustomCommandStatus.Success, message: `§aGranted ${formatCurrency(roundedAmount)} to ${names}.` };
}
