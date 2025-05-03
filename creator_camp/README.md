---
page_type: sample
author: mammerla
description: A basic progressive example of using custom block features within Minecraft.
ms.author: mikeam@microsoft.com
ms.date: 01/31/2024
products:
  - minecraft
---

# Minecraft Creator Camp Sample Project

This sample demonstrates custom entities, blocks, and worldgen features demonstrated as part of [Creator Camp](https://aka.ms/creatorcamp).

- Custom Entity: Camp Ghost
- Custom Block: Pile of Leaves
- Custom Item: Leaf Bag
- Jigsaw Structures: Tent/Camp Area
- Features: Tall Camp Trees

## Important!

Because this targets beta versions of Minecraft Scripting APIs (2.0.0), you should use

```powershell
npm i --legacy-peer-deps
```

to install dependencies.

This project will also deploy against the Preview version of Minecraft.

## Prerequisites

**Install Node.js tools, if you haven't already**

We're going to use the package manager [npm](https://www.npmjs.com/package/npm) to get more tools to make the process of building our project easier.

Visit [https://nodejs.org/](https://nodejs.org).

Download the version with "LTS" next to the number and install it. (LTS stands for Long Term Support, if you're curious.) In the Node.js Windows installer, accept the installation defaults. You do not need to install any additional tools for Native compilation.

**Install Visual Studio Code, if you haven't already**

Visit the [Visual Studio Code website](https://code.visualstudio.com) and install Visual Studio Code.

## Getting Started

1. To make your own environment look like the example, create a folder on your `C:\` drive and call it **projects**. Create a subfolder called **custom_blocks**.

1. Put the extracted contents of the custom_blocks folder into **custom_blocks**.

1. Open a Windows Terminal or PowerShell window and change the working directory to your **custom_blocks** folder:

   ```powershell
   cd c:\projects\custom_blocks\
   ```

1. Use npm to install our tools:

   ```powershell
   npm i --legacy-peer-deps
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

This sample demonstrates various things you can build together that can be used to create fun camping experiences. See the [Minecraft Creator Channel](https://aka.ms/creatorcamp) for all the fun camping videos that accompany this demo.

## Manifest

- [behavior_packs/creator_camp](https://github.com/microsoft/minecraft-samples/blob/main/creator_camp/behavior_packs/creator_camp): This contains behavior implementations for a set of creator_camp items.
- [resource_packs/creator_camp](https://github.com/microsoft/minecraft-samples/blob/main/creator_camp/resource_packs/creator_camp): This contains resources for a set of creator_camp items.
