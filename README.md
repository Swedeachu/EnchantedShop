# Enchanted Shop

Bedrock Dedicated Server behavior pack written in TypeScript using:

* `@minecraft/server`
* `@minecraft/server-ui`

It provides a PvP lobby with:

* Static and rotating shops
* Items and kits
* Player currency
* Safe inventory delivery
* Persistent player data
* Loading → Hub scene flow
* Mister ShopMan NPC
* Flat lobby platform generation for my testing
* Operator money command
* Lightweight system/component architecture

---

## Setup

### Requirements

* Node.js 18+
* Windows / PowerShell
* Bedrock Dedicated Server

Download BDS:

https://www.minecraft.net/en-us/download/server/bedrock

Extract it directly into:

```text
server/
```

You should have:

```text
server/bedrock_server.exe
```

---

## Build

For normal development, just run:

```text
rebuild.bat
```

This installs dependencies if needed and builds the behavior pack.

Or use npm directly:

```powershell
npm install
npm run build
```

Watch mode:

```powershell
npm run watch
```

Built scripts are written to:

```text
packs/EnchantedShop_BP/scripts/
```

---

## Run

Double-click:

```text
start.bat
```

Or:

```powershell
npm run start:server
```

The launcher automatically:

1. Copies the latest behavior pack into the BDS folder.
2. Creates the world if it does not exist.
3. Activates the behavior pack for the world.
4. Starts BDS.
5. Restarts BDS after a crash.

Type:

```text
stop
```

in the BDS console for a clean shutdown.

Set:

```text
AUTO_RESTART=0
```

in `start.bat` to disable automatic restarts.

---

## Flat Lobby

BDS does not support Java's `level-type=flat` behavior so I just wrote code to auto gen a flat grass platform.

Configuration lives in:

```text
src/config/GameConfig.ts
```

The generated platform only needs to be built once.

---

## In Game

Players enter:

```text
LoadingScene
    ↓
HubScene
```

The loading scene restores persistent player data before sending them to the lobby.

Inside the hub:

* Players spawn on the generated platform.
* Their coin balance appears on the sidebar.
* Mister ShopMan opens the shop.
* Purchases are inserted directly into inventory.
* Items are never dropped on the ground if inventory space is unavailable.

The shop flow is roughly:

```text
Shop
 ├─ Static Shop
 └─ Rotating Shop
      ↓
   Category
      ↓
     Item
      ↓
   Quantity
      ↓
   Purchase
```

---

## Money Command

Operators can give players currency with:

```text
/enchantedshop:money <player> <amount>
```

Custom Bedrock commands require a namespace, so the command cannot simply be `/money`.

Cheats must be enabled in `server.properties`.

---

# Project Structure

```text
src/
├─ commands/
├─ config/
├─ core/
│  ├─ components/
│  ├─ entities/
│  ├─ persistence/
│  └─ scenes/
├─ entities/
├─ items/
├─ kits/
├─ scenes/
├─ shop/
├─ systems/
├─ ui/
└─ main.ts
```

---

## Core

### `System.ts`

Base class for game systems.

Systems can handle lifecycle/events such as:

```text
onInit
onTick
onSecond
onPlayerJoin
onPlayerSpawn
onPlayerLeave
onPlayerInteractWithEntity
onShutdown
```

### `SystemManager.ts`

Owns and initializes the game's systems.

Current order:

```text
PlayerSystem
CurrencySystem
KitsSystem
DeliverySystem
ShopSystem
EntitySystem
SceneSystem
```

It also routes Script API events to the systems that care about them.

### Components

Per-player state is stored in lightweight components instead of one giant player class.

Examples:

```text
CurrencyComponent
OwnedKitsComponent
```

Serializable components are persisted with Bedrock dynamic properties.

---

# Scenes

Scenes represent shared game areas/states.

There is one shared instance of each scene rather than one instance per player.

### `LoadingScene`

Initial player state.

Restores player data and then transfers the player into the hub.

### `HubScene`

Main PvP lobby.

Responsible for:

* Spawn platform
* Hub spawn
* Mister ShopMan
* Currency scoreboard
* Player entry into the lobby

---

# Systems

### `PlayerSystem`

Tracks connected players and their `GamePlayer` wrappers.

### `CurrencySystem`

Handles:

* Balances
* Starting currency
* Purchases
* Grants
* Persistence

### `KitsSystem`

Tracks purchased kits and persists ownership.

### `DeliverySystem`

Safely inserts purchased items into player inventories.

### `ShopSystem`

Handles:

* Static shops
* Rotating shops
* Shop stock
* Rotation timing
* Persistent rotation state

### `EntitySystem`

Generic scripted NPC system.

NPCs can define behaviors for:

```text
attach
interact
hit
tick
```

It also supports invincible/static NPCs and prevents unwanted vanilla interactions.

---

# Mister ShopMan

Defined in:

```text
src/entities/ShopManNpc.ts
```

Mister ShopMan is a normal Bedrock villager controlled by the script.

He is a lobotomized slave for us:

* Cannot take damage
* Cannot wander away
* Does not open the vanilla trading UI
* Opens the custom shop when interacted with or hit
* Uses the cartographer appearance for swag purposes

---

# Items and Kits

## Items

`src/items/ItemFactory.ts` converts reusable item definitions into real Bedrock `ItemStack`s.

Definitions can include:

* Item type
* Amount
* Enchantments

Large amounts are automatically split into valid stack sizes.

## Kits

Kit configuration lives in:

```text
src/kits/
```

A kit contains:

* ID
* Name
* Category
* Description
* Price
* Items

Shops can sell kits and normal items side by side.

---

# Shop Configuration

Static shop:

```text
src/shop/StaticShopConfig.ts
```

Rotating shop:

```text
src/shop/RotatingShopConfig.ts
```

General game configuration:

```text
src/config/GameConfig.ts
```

This includes things such as:

* Starting currency
* Currency name
* Hub position
* Platform size
* NPC position
* Shop rotation duration
* Autosave interval

---

# Shop UI

Main UI code:

```text
src/ui/ShopUI.ts
```

Purchase flow:

```text
Shop
→ Category
→ Entry
→ Quantity / Confirmation
→ Purchase
```

The maximum quantity is calculated from:

```text
player balance
remaining stock
```

Purchases are validated again before currency or stock is modified.

---

# Persistence

Persistent state uses Bedrock dynamic properties.

Used for things such as:

* Currency
* Owned kits
* Rotating shop state

Helpers live in:

```text
src/core/persistence/DynamicPropertyCodec.ts
```

---

# Entry Point

```text
src/main.ts
```

Registers the custom command during startup and initializes the game systems after the world loads.

---

# Development

Typecheck:

```powershell
npm run typecheck
```

Build:

```powershell
npm run build
```

Watch:

```powershell
npm run watch
```

Run:

```powershell
npm run start:server
```

Typical workflow:

```text
git clone
   ↓
rebuild.bat
   ↓
start.bat
```

---

## Status

Implemented:

* Build/deployment automation
* Loading and Hub scenes
* Persistent currency
* Persistent kit ownership
* Static shop
* Rotating shop
* Inventory delivery
* Shop NPC
* Generated lobby platform
* Currency scoreboard
* Operator money command

Still worth doing:

* Full in-game playtest
* Balance shop prices
* Tune kit contents
* Tune hub/platform size
