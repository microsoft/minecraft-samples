---
page_type: sample
author: mammerla
description: An add-on for Minecraft and the Minecraft Editor for managing debug states and configuration.
ms.author: mikeam@microsoft.com
ms.date: 07/16/2024
languages:
  - typescript
products:
  - minecraft
---

# Minecraft Debug Tools

This sample contains many code snippets that show how you can manipulate basic Minecraft behaviors.

## Prerequisites

**Install Node.js tools, if you haven't already**

We're going to use the package manager [npm](https://www.npmjs.com/package/npm) to get more tools to make the process of building our project easier.

Visit [https://nodejs.org/](https://nodejs.org).

Download the version with "LTS" next to the number and install it. (LTS stands for Long Term Support, if you're curious.) In the Node.js Windows installer, accept the installation defaults. You do not need to install any additional tools for Native compilation.

**Install Visual Studio Code, if you haven't already**

Visit the [Visual Studio Code website](https://code.visualstudio.com) and install Visual Studio Code.

## Getting Started

1. Use npm to install dependent modules:

   ```powershell
   npm i
   ```

1. Use this shortcut command to open the project in Visual Studio Code:

   ```powershell
   code .
   ```

### Chapter 2. Let's test the parts of our project

Within the root folder (debug_tools) of this sample, run this command:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Run this one to deploy in the game.

```powershell
npm run local-deploy
```

If you'd like to run deployment in a watch mode, run the following:

```powershell
npm run local-deploy -- --watch
```

Create an addon file to share.

```powershell
npm run mcaddon
```

## Manifest

- [just.config.ts](https://github.com/microsoft/minecraft-samples/blob/main/debug_tools/just.config.ts): This file contains build instructions for just-scripts, for building out TypeScript code.
- [scripts](https://github.com/microsoft/minecraft-samples/blob/main/debug_tools/scripts): This contains Debug Tools TypeScript files, that will be compiled and built into your projects.
- [behavior_packs](https://github.com/microsoft/minecraft-samples/blob/main/debug_tools/behavior_packs): This contains resources and JSON files that define your behavior pack.
