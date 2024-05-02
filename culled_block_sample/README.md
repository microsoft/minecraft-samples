---
page_type: sample
author: mammerla
description: A basic example of using new culled block features within Minecraft 1.20.60 and beyond.
ms.author: mikeam@microsoft.com
ms.date: 01/31/2024
products:
  - minecraft
---

# Minecraft Add-On Starter Project

This sample demonstrates a simple build process and TypeScript compilation for Minecraft. This readme shows how you can use Betas APIs experiment to build out simple gameplay styles. You can use this project as a starter for your own scripting projects.

## Prerequisites

**Install Node.js tools, if you haven't already**

We're going to use the package manager [npm](https://www.npmjs.com/package/npm) to get more tools to make the process of building our project easier.

Visit [https://nodejs.org/](https://nodejs.org).

Download the version with "LTS" next to the number and install it. (LTS stands for Long Term Support, if you're curious.) In the Node.js Windows installer, accept the installation defaults. You do not need to install any additional tools for Native compilation.

**Install Visual Studio Code, if you haven't already**

Visit the [Visual Studio Code website](https://code.visualstudio.com) and install Visual Studio Code.

## Getting Started

1. To make your own environment look like the example, create a folder on your `C:\` drive and call it **projects**. Create a subfolder called **culled_blocks**.

1. Put the extracted contents of the culled_block_sample folder into **culled_blocks**.

1. Open a Windows Terminal or PowerShell window and change the working directory to your **culled_blocks** folder:

   ```powershell
   cd c:\projects\culled blocks\
   ```

1. Use npm to install our tools:

   ```powershell
   npm i
   ```

1. When that's done, enter:

   ```powershell
   npm i gulp-cli --global
   ```

1. Use this shortcut command to open the project in Visual Studio Code:

   ```powershell
   code .
   ```

It might also ask you to install the Minecraft Debugger and Blockception's Visual Studio Code plugin, which are plugins to Visual Studio Code that can help with Minecraft development. Go ahead and do that, if you haven't already.

# Minecraft Block Culling Usage

This sample demonstrates how to use block culling on the **tuna_roll** custom block. 

After downloading these add-on packs:

1. Insert UUIDs in the manifests.
1. Put them in their respective folders in your com.Mojang folder.
1. Make a creative Minecraft world.
1. `/give @s demo:tuna_roll`
1. Place 3 tuna roll blocks.
1. Replace the center block with a full-sized block like "acacia planks".
1. You will see the geometry of the tuna roll blocks change.

### Summary

This sample demonstrates how to use block culling on the **tuna_roll** custom block.

## Manifest

- [gulpfile.js](https://github.com/microsoft/minecraft-scripting-samples/blob/main/ts-starter/gulpfile.js): This file contains build instructions for Gulp, for building out TypeScript code.
- [behavior_packs](https://github.com/microsoft/minecraft-scripting-samples/blob/main/ts-starter/behavior_packs): This contains resources and JSON files that define your behavior pack.
