import { world, system } from "@minecraft/server";
import { SystemManager } from "./core/SystemManager";
import { Logger } from "./core/Logger";
import { registerMoneyCommand } from "./commands/MoneyCommand";

const logger = new Logger("Main");

// beforeEvents.startup runs in early-execution/read-only mode - it fires
// before the world is ready, so this is for logging/registration only,
// never for touching world/player state. Custom commands specifically can
// ONLY be registered here - the registry is unavailable after this event.
system.beforeEvents.startup.subscribe((event) => {
  logger.info("Enchanted Shop script starting up...");
  registerMoneyCommand(event.customCommandRegistry);
});

// Everything that touches the world (systems, event subscriptions, the
// tick loop) is deferred until the world has actually finished loading.
world.afterEvents.worldLoad.subscribe(() => {
  logger.info("World loaded - bringing systems online.");
  SystemManager.get().init();
});
