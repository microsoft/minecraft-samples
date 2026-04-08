---
page_type: sample
author: mammerla
description: Demonstrates custom dimensions in Minecraft Bedrock using the Script API, including procedural platform building, dimension travel, and an endless runner mini-game.
ms.author: mikeam@microsoft.com
ms.date: 04/08/2026
languages:
  - typescript
products:
  - minecraft
---

# Custom Dimensions Sample

This sample demonstrates how to create and manage **custom dimensions** using the Minecraft Bedrock Script API. It registers three custom dimensions, builds procedural platforms inside them, and provides a player-facing travel menu. One of the dimensions hosts an **endless runner** mini-game with auto-generated terrain and zombie pursuers.

## What's Inside

### Custom Dimensions

| Dimension                                        | Description                                                                 |
| ------------------------------------------------ | --------------------------------------------------------------------------- |
| **Void Arena** (`custom_dim:void_arena`)         | A crimson nylium platform floating in the void with a placed structure.     |
| **Sky Lounge** (`custom_dim:sky_lounge`)         | A quartz platform at y=100 with glowstone corner lighting.                  |
| **Endless Runner** (`custom_dim:endless_runner`) | A narrow deepslate ledge that extends as you run. Zombies spawn behind you! |

### Key Features

- **Dimension registration** via `system.beforeEvents.startup` and `dimensionRegistry.registerCustomDimension()`
- **Procedural platform building** with `BlockPermutation` and `fillBlocks()`
- **Ticking area management** to ensure chunks are loaded before placing blocks or teleporting players
- **Structure placement** using `world.structureManager.place()`
- **Custom command** `/custom_dim:dimensions` to open the travel menu (no cheats required)
- **Action form UI** (`ActionFormData`) for dimension selection
- **Endless runner game loop** using `system.runInterval()` with dynamic ledge generation, zombie spawning with speed effects, and automatic cleanup

### Endless Runner

When a player teleports to the Endless Runner dimension:

1. A small starting platform is built and the first ledge segment extends forward (+Z direction)
2. The player receives **Speed II** to keep things fast-paced
3. A game loop runs 4 times per second and:
   - Extends the 3-wide ledge by 30 blocks when the player approaches the frontier
   - Adds glass rails and glowstone lighting along the path
   - Spawns a **Speed II zombie** behind the player every ~4 seconds
   - Cleans up zombies that fall into the void
   - Detects if the player falls off the path (game over)
4. Everything is cleaned up automatically when the player leaves the dimension

## Prerequisites

### Node.js

Visit [https://nodejs.org/](https://nodejs.org) and install the LTS version.

### Visual Studio Code

Visit the [Visual Studio Code website](https://code.visualstudio.com) and install Visual Studio Code.

## Getting Started

1. Clone or download this project.

2. Install dependencies:

   ```powershell
   npm i
   ```

3. Open the project in Visual Studio Code:

   ```powershell
   code .
   ```

4. Build and deploy to Minecraft using the build task or:

   ```powershell
   npm run local-deploy
   ```

   For watch mode (auto-recompile on save):

   ```powershell
   npm run local-deploy -- --watch
   ```

5. In Minecraft, create a new world:
   - Select **Creative** game mode
   - Select a **Flat** world under the Advanced section
   - Under **Behavior Packs**, activate the **Custom Dimensions** pack
   - Create the world

6. In game, run `/custom_dim:dimensions` to open the dimension travel menu and pick a destination.

## Project Structure

| Path                                                          | Description                                                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `scripts/main.ts`                                             | All game logic — dimension registration, platform building, travel menu, and endless runner |
| `behavior_packs/creator_customdi/manifest.json`               | Behavior pack manifest with Script API dependencies                                         |
| `behavior_packs/creator_customdi/structures/turn.mcstructure` | Pre-built structure placed in the Void Arena                                                |
| `resource_packs/creator_customdi/manifest.json`               | Resource pack manifest                                                                      |
