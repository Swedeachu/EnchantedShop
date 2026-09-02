# Enchanted Shop (PvP Lobby Shop) - dev setup

TypeScript behavior pack targeting **Bedrock Dedicated Server (BDS)**, using the
`@minecraft/server` / `@minecraft/server-ui` Script API. It implements a full
NPC-driven shop (static + rotating limited-stock shops, kits and generic
items side by side, a currency economy, safe inventory delivery), a
Loading -> Hub scene flow that loads each player's data before dropping them
into a single shared lobby everyone stands in together, a flat spawn
platform the pack builds itself, and an op-only `/money` command - all
built on a `SystemManager`/`GameSystem` foundation.

## 1. Prerequisites (run these yourself - this repo's automation can't reach
   the internet or your terminal, only your files)

- [Node.js LTS](https://nodejs.org/) (18+) - this also installs npm
- PowerShell (bundled with Windows)

Dependencies themselves don't need a separate manual step: `rebuild.bat`
runs `npm install` for you every time (a fast no-op once `node_modules`
already matches `package-lock.json`), specifically so a fresh clone doesn't
need anything typed into a terminal at all - see step 3.

## 2. Get the Bedrock Dedicated Server

Official download page: https://www.minecraft.net/en-us/download/server/bedrock
Direct link for the version this project targets (Windows, 1.26.45.1):

https://www.minecraft.net/bedrockdedicatedserver/bin-win/bedrock-server-1.26.45.1.zip

(The link changes with every BDS release - if it 404s, grab the current
Windows zip from the download page above and update `min_engine_version` in
`packs/EnchantedShop_BP/manifest.json` if the game version moved forward a lot.)

Extract the zip **directly into `server/`**, so you end up with
`server/bedrock_server.exe` at the top level (not nested one folder deeper).

### Flat world - what actually works on Bedrock

`server.properties` still has `level-type=flat` set, but it's a no-op:
Bedrock Dedicated Server does not have a flat-world server.properties
setting at all (confirmed against Microsoft's own property reference, which
doesn't list `level-type` among BDS's properties, and against Bedrock-specific
hosting guides that say outright there's no server-side flat-world switch -
that's a Java Edition thing). The line is left in place with a comment
explaining this, rather than silently removed, so it doesn't get "fixed"
back in later.

The real fix: the pack builds its own flat platform in script, once, the
first time the world loads (`src/world/SpawnPlatform.ts`, invoked from
`HubScene.init()`). It carves a flat stone/dirt/grass square out of whatever
terrain naturally generated at the hub spawn point and clears the air above
it, then sets that as the world's default spawn location. This happens
automatically - there's nothing to configure - and is guarded by a world
dynamic property so it only ever runs once, even across restarts. Tune the
footprint/thickness/clearance in `GameConfig.hub.platform` before your first
launch if you want it bigger or smaller.

(If you ever want a genuinely infinite flat world instead of a bounded
platform, that requires creating the world as Superflat on a Bedrock client
and copying the resulting world folder onto the server - there's no way to
automate that step from server.properties or from script.)

## 3. Build the pack

Just double-click **`rebuild.bat`** at the repo root - it runs `npm install`
(first time only - see step 1) then `npm run build` and pauses so you can
read the result. This is the only build step a fresh clone needs; from
source to a built pack is `git clone` -> `rebuild.bat` -> `start.bat`
(next section), nothing else typed anywhere.

Prefer the command line, or rebuilding on every save while developing?

```powershell
npm install        # first time only - rebuild.bat does this for you too
npm run build       # one-off build -> packs/EnchantedShop_BP/scripts/main.js
npm run watch        # rebuilds on every save while you're developing
```

## 4. Run the server

```powershell
npm run start:server
```

(or just double-click `start.bat` at the repo root). This is a genuine
one-click "clone it and go" launcher, even the very first time - every
launch, it:

1. Deploys the pack as **real files** into `server\behavior_packs\EnchantedShop_BP`
   (a clean delete + copy from `packs\EnchantedShop_BP`, every time) rather
   than relying on a directory junction. A junction is one more thing that
   can silently go stale/broken, and when it does, `bedrock_server.exe`
   doesn't error - it just loads *zero* behavior packs (`Pack Stack - None`
   in the log) with nothing telling you why. A plain file copy on every
   launch removes that failure mode entirely.
2. Runs `tools\prepare-server.ps1`, which makes sure a world exists **and**
   has the pack activated on it, in one shot:
   - If `server\worlds\<level-name>\` doesn't exist yet (a brand new clone),
     it launches `bedrock_server.exe` itself just long enough to create the
     world, sends it a clean `stop` over stdin the moment the world files
     show up on disk, and waits for it to exit - all before your real
     session ever starts. This is what removes the old "first launch
     creates the world, but doesn't load the pack - restart once more"
     two-step dance; a fresh clone now gets the pack active on its very
     first real launch.
   - Either way (fresh or already existing), it then writes
     `server\worlds\<level-name>\world_behavior_packs.json` from the pack's
     own `manifest.json` (uuid + version), so a pack version bump is picked
     up automatically on every future launch too.
3. `cd`'s into `server\`, starts `bedrock_server.exe` for real, and
   auto-restarts it if it crashes (5s countdown - Ctrl+C then `Y` during the
   countdown to back out instead). Type `stop` in the server console for a
   clean shutdown; that exits 0 and the script won't restart it. Set
   `AUTO_RESTART=0` near the top of `start.bat` to disable the restart loop
   entirely.

Watch the console - `src/main.ts` logs on startup and once the world loads,
`LoadingScene`/`HubScene` log every player's load-and-enter, and
`PlayerSystem` logs every join/spawn/leave.

## 5. Try it out in-game

A new player lands in `LoadingScene` for a moment (their currency/kit data
is hydrated from dynamic properties - effectively instant, but logged
either way) and is then moved into `HubScene`: teleported onto the flat
platform, greeted, and shown a live "Coins" sidebar scoreboard. Find
**Mister ShopMan** (an unemployed, jobless villager - he never opens the
vanilla trade UI) and interact with him to open the shop menu. From there:
category -> item or kit -> a purchase form with a quantity slider capped to
what you can actually afford -> confirm. Purchased items/kits go straight
into your inventory (never dropped on the ground); a full inventory tells
you instead of silently discarding anything.

`allow-cheats=true` is set in `server.properties` so operator commands work.
`xSwedeachu` is already added to `server/permissions.json` as an operator
(their xuid was captured from a previous server log - to op anyone else,
have them join once, copy their xuid from the console log's "Player
connected: <name>, xuid: <xuid>" line, and add
`{ "permission": "operator", "xuid": "<xuid>" }` to `permissions.json`).

Operators can grant currency with:

```
/enchantedshop:money <player> <amount>
```

(Bedrock's Custom Commands API requires every command name to carry a
namespace - there's no way to expose a bare `/money`, so this is the closest
equivalent. Tab-completion will show it as soon as you type
`/enchantedshop:`.)

---

## Architecture

### Foundation (`src/core/`)

- **`System.ts`** - `GameSystem` abstract base class every system extends.
  `onInit` is mandatory; `onTick`, `onSecond`, `onPlayerJoin`, `onPlayerSpawn`,
  `onPlayerLeave`, `onPlayerInteractWithEntity`, `onShutdown` are all optional
  overrides (no-op by default).
- **`SystemManager.ts`** - singleton that constructs every system once, in a
  fixed registration order (= init order = event-dispatch order):
  `PlayerSystem` -> `CurrencySystem` -> `KitsSystem` -> `DeliverySystem` ->
  `ShopSystem` -> `EntitySystem` -> `SceneSystem` (last, on purpose - see
  "Scenes" below). Also constructs `LoadingScene`/`HubScene` and registers
  them into `SceneSystem`. Subscribes to every Script API event exactly once
  and fans each one out to every registered system. Exposes a typed getter
  per system (`getPlayerSystem()`, `getShopSystem()`, etc.).
- **`scenes/Scene.ts` + `scenes/SceneSystem.ts`** - Scenes are **shared**
  places, not per-player ones: exactly one instance of `LoadingScene` and
  one instance of `HubScene` exist for the whole server (constructed once,
  in `SystemManager`'s constructor), the same as any other system. Any
  number of players can be in `HubScene` at the same time, all standing in
  the same in-memory lobby, seeing the same Mister ShopMan and scoreboard.
  What `SceneSystem` tracks per-player is only *which* shared scene each
  player is currently assigned to (a `Map<playerId, Scene>`) - never a
  separate scene instance per player. `Scene.init()` runs once per scene
  after the world loads (safe to touch world/entity state), and
  `onPlayerEnter`/`onPlayerExit`/`onSecond` are per-player *notifications*
  fired on that one shared instance, not separate state. Anything that
  genuinely differs per player (currency balance, owned kits, ...) lives on
  that player's `ComponentContainer`, never as a field on a `Scene`.
  `SceneSystem` is registered **last** in `SystemManager` specifically so
  that its `onPlayerSpawn` - which places a freshly-joined player into the
  default scene (`LoadingScene`) - always runs *after*
  `CurrencySystem`/`KitsSystem`/`DeliverySystem` have already hydrated that
  player's data for the session; otherwise Loading could hand a player off
  before there was anything to actually load.
- **`components/ComponentContainer.ts`** - the "ECS-lite" symbol-keyed data
  component bag. Per-player state (currency balance, owned kits, pending
  deliveries) is attached one component class at a time instead of growing a
  monolithic player class. Components that need to survive a restart
  implement `Serializable<T>`.
- **`persistence/DynamicPropertyCodec.ts`** - `readJson`/`writeJson` helpers
  over the `DynamicPropertyHolder` interface (satisfied structurally by both
  `Player` and `World`), used to persist/hydrate every serializable
  component and the rotating shop's stock state as JSON.

### Scenes (`src/scenes/`)

- **`LoadingScene.ts`** - the default scene every player is placed into the
  instant they first spawn. Since every data-owning system already hydrated
  its component for this player before `SceneSystem` (registered last)
  dispatches `onPlayerSpawn`, there's nothing left to actually wait on - this
  scene's job is to be a well-defined, cleanly-logged checkpoint ("loading
  your data..." -> "finished loading: 100 Coins, 0 kit(s) owned - entering
  Hub") before handing the player to `HubScene`, one tick later (deferred
  so it never races the engine's own initial-spawn placement).
- **`HubScene.ts`** - the PvP lobby itself. `init()` (once, after world load)
  builds the flat spawn platform, points the world's default spawn at it,
  ensures Mister ShopMan is spawned, and sets up the currency sidebar
  scoreboard. `onPlayerEnter` teleports the player onto the platform,
  refreshes their scoreboard score, and greets them; `onSecond` keeps every
  hub player's on-screen balance live (covers shop purchases and
  `/enchantedshop:money` grants alike).

### Config (script-side only - never in dynamic properties)

- **`config/GameConfig.ts`** - central tunables: currency name/starting
  balance, Mister ShopMan's dimension/spawn location/name tag/leash radius,
  the hub's spawn location + flat-platform footprint/thickness/clearance +
  scoreboard objective id, the rotating shop's rotation duration, and the
  autosave interval.
- **`kits/KitTypes.ts` + `KitsConfig.ts`** - `KitCategory` enum (Starter /
  PvP / Archer) and every kit definition (id, display name, category,
  description, price, contents as `ItemDefinition[]`). Kits load into the
  shop automatically by being referenced from `StaticShopConfig.ts` /
  `RotatingShopConfig.ts` - nothing needs to be registered twice.
- **`shop/ShopTypes.ts`** - `ShopEntryKind` (Item | Kit) and the
  `ShopEntry` union, so a shop can sell generic items and kits side by side.
  `RotatingShopRotation` bundles a full curated snapshot (entries + max
  stock per entry) for one rotation slot.
- **`shop/StaticShopConfig.ts`** / **`shop/RotatingShopConfig.ts`** -
  example contents for both shops (currently: a few generic items plus kits
  pulled from `KITS_CONFIG`).
- **`shop/ShopFormatting.ts`** - humanizes enchantment ids/levels and prices
  for display, so a kit's enchants/tiers show up explicitly in the UI
  instead of only being implied by its name.
- **`items/ItemFactory.ts`** - `ItemDefinition`/`EnchantmentDefinition`,
  `createItemStacks()` (builds `ItemStack`s from a definition, correctly
  splitting across multiple stacks when the requested amount exceeds the
  item's real `maxAmount` instead of silently clamping), and
  `itemStackToDefinition()` for the reverse direction.

### Systems (`src/systems/`)

- **`PlayerSystem.ts`** - tracks online players as `GamePlayer` wrappers
  (each holding a live `Player` reference, since the leave event doesn't
  give you one), and is where every other system looks up the current
  `GamePlayer` for a given `Player`.
- **`CurrencySystem.ts`** - owns `CurrencyComponent` (a serializable
  balance), hydrates it from dynamic properties on join, grants the
  starting balance to brand-new players, and exposes
  `getBalance`/`canAfford`/`charge`/`grant` (the last two used by both the
  shop and the `/enchantedshop:money` command), persisting immediately after
  every mutation since a `Player` reference isn't available on leave.
- **`KitsSystem.ts`** - owns `OwnedKitsComponent`, tracking which kit ids a
  player has purchased, hydrated/persisted the same way.
- **`DeliverySystem.ts`** - takes a resolved list of `ItemStack`s and a
  target player and places them directly into the player's inventory
  container, splitting/rejecting only what doesn't fit and reporting back
  what (if anything) couldn't be delivered - items are never dropped on the
  ground.
- **`ShopSystem.ts`** - the shop engine: resolves the static shop from
  `StaticShopConfig`, and drives the rotating shop's lifecycle from a single
  world dynamic property (`{ rotationIndex, stock, nextRotationAtEpochMs }`).
  On init/tick it runs `catchUpRotations()`, which advances rotation-by-
  rotation anchored off the previously scheduled timestamp (not
  `Date.now()`), so a long server downtime lands on the mathematically
  correct rotation instead of skipping straight to "now". Also owns
  per-entry stock decrement/validation for the rotating shop.
- **`core/entities/EntitySystem.ts`** - generic NPC registry, not specific
  to Mister ShopMan: any `NpcDefinition` (id, entity type, tag, spawn
  location, a list of `NpcBehavior`s) registered via `registerNpc()` gets
  spawned/re-spawned and has `onAttach`/`onInteract`/`onHit`/`onTick`
  behaviors fanned out to it. Treats NPCs as statues, not saved state: on
  every spawn attempt it first removes any stray entity already wearing
  that NPC's tag, then spawns a fresh one - so "what's standing there" is
  always fully owned by the script, never left ambiguous by whatever the
  world file happened to save. Also intercepts vanilla behavior *before* it
  happens: `world.beforeEvents.playerInteractWithEntity` is cancelled for
  any registered NPC (which is what stops the vanilla trade UI from opening
  on a villager) before dispatching to that NPC's own `onInteract`
  behaviors, and `world.beforeEvents.entityHurt` is cancelled for any NPC
  whose definition sets `invincible: true`.
- **`entities/ShopManNpc.ts`** - Mister ShopMan's own `NpcDefinition`: a
  plain `minecraft:villager_v2` (no custom entity - simplest thing that
  reliably spawns and renders), `invincible: true`, composed from
  `stationaryBehavior` (`core/entities/behaviors/StationaryBehavior.ts` -
  permanent Slowness+Resistance re-applied every few seconds plus a
  per-tick snap-back teleport to his exact spawn point, so nothing can push
  or wander him even a fraction of a block) and
  `openShopOnInteractOrHit` (`entities/behaviors/OpenShopBehavior.ts` -
  opens the shop UI on either interact or a punch) and
  `triggerEventsOnAttach("minecraft:become_cartographer")`
  (`core/entities/behaviors/TriggerEventBehavior.ts` - purely cosmetic,
  forces the cartographer look via the real vanilla profession-change
  event, without a job site block).

### Commands (`src/commands/`)

- **`MoneyCommand.ts`** - registers `/enchantedshop:money <targets> <amount>`
  via the Custom Commands API (`system.beforeEvents.startup`'s
  `customCommandRegistry` - the only place custom commands can be
  registered, well before `SystemManager`/`CurrencySystem` exist, so the
  callback reaches `CurrencySystem` lazily via `SystemManager.get()` at
  call time). `permissionLevel: GameDirectors` restricts it to operators;
  `cheatsRequired: true` (the default) means `allow-cheats=true` in
  `server.properties` is required for it to run at all.

### UI (`src/ui/ShopUI.ts`)

`openShopMenu` (static vs. rotating) -> `openCategoryMenu` ->
`openEntryListMenu` (shows price +, for kits, every enchant/tier inline) ->
`openPurchaseMenu`, which picks one of two purchase screens depending on
how many the player can actually afford: exactly 1 goes to a plain
`ActionFormData` confirmation (a slider can't represent a 1-1 range), and
more than 1 goes to `openQuantitySliderMenu` - a `CustomForm` (Bedrock's
reactive data-driven UI, stable since `@minecraft/server-ui` 2.1.0) whose
slider is bound to an `ObservableNumber`, with a label that updates live as
it's dragged showing the running total cost and, for a kit, each content
item scaled to the selected quantity. The slider's max is always computed
live from `min(currency the player can afford / price, remaining stock if
rotating)` - never a fixed constant like 64. Either path ends at
`completePurchase` (re-validates affordability/stock against live state,
deducts currency, builds the `ItemStack`s via `ItemFactory`, hands them to
`DeliverySystem`, and shows a toast via `ToastNotification.ts`).

### Entry point

- **`src/main.ts`** - registers `system.beforeEvents.startup` (logs, and
  registers `/enchantedshop:money` - world isn't ready yet, so this is
  registration only, never world/player state) and
  `world.afterEvents.worldLoad` (calls `SystemManager.get().init()`, which
  subscribes to every event above and starts a `system.runInterval` tick
  loop, including the autosave and rotating-shop catch-up checks).

## Status

Everything described above is implemented and currently typechecks clean
(`npm run typecheck`). Not yet done: an in-game playtest pass confirming the
flat platform / Hub flow / shop / `/enchantedshop:money` all work end to end
on a real launch, and tuning the example shop/kit contents, prices, and
platform size to taste.
