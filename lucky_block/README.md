---
page_type: sample
author: mammerla
description: A basic progressive example of using custom block features within Minecraft.
ms.author: mikeam@microsoft.com
ms.date: 01/31/2024
products:
  - minecraft
---

# Minecraft Lucky Block Project

This sample demonstrates a lucky block types in Minecraft, including a simple build process and TypeScript compilation for Minecraft. A Lucky Block is a block you can interact with that spawns random things, in addition to having a custom model. All files are in the version_1 folder. Hopefully there will be an extended version soon :)

See this [YouTube video on the Minecraft Creator Channel](https://www.youtube.com/watch?v=b4isyG5t9NQ) for a quick look on how this was created.

## Prerequisites

**Install Node.js tools, if you haven't already**

We're going to use the package manager [npm](https://www.npmjs.com/package/npm) to get more tools to make the process of building our project easier.

Visit [https://nodejs.org/](https://nodejs.org).

Download the version with "LTS" next to the number and install it. (LTS stands for Long Term Support, if you're curious.) In the Node.js Windows installer, accept the installation defaults. You do not need to install any additional tools for Native compilation.

**Install Visual Studio Code, if you haven't already**

Visit the [Visual Studio Code website](https://code.visualstudio.com) and install Visual Studio Code.

## Getting Started

1. To make your own environment look like the example, create a folder on your `C:\` drive and call it **projects**. Create a subfolder called **lucky_block**.

1. Put the extracted contents of the lucky_block\version_1 folder into **lucky_block**.

1. Open a Windows Terminal or PowerShell window and change the working directory to your **lucky_block** folder:

   ```powershell
   cd c:\projects\lucky_block\
   ```

1. Use npm to install our tools:

   ```powershell
   npm i
   ```

1. When that's done, enter:

   ```powershell
   npm run local-deploy
   ```

1. Use this shortcut command to open the project in Visual Studio Code:

   ```powershell
   code .
   ```

It might also ask you to install the Minecraft Debugger and Blockception's Visual Studio Code plugin, which are plugins to Visual Studio Code that can help with Minecraft development. Go ahead and do that, if you haven't already.

### Summary

This sample demonstrates:

- custom block states
- custom models
- Using a block custom action

## Manifest

- [version_1/behavior_packs/lucky_block](https://github.com/microsoft/minecraft-samples/blob/main/lucky_block/version_1/behavior_packs/lucky_block): This contains behavior implementations for the lucky block.
- [version_1/resource_packs/lucky_block](https://github.com/microsoft/minecraft-samples/blob/main/lucky_block/version_1/resource_packs/lucky_block): This contains resources for the lucky block.
