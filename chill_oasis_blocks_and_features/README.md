---
page_type: sample
author: mammerla
description: An example of using custom biomes and custom biome replacement experimental features
ms.author: mikeam@microsoft.com
ms.date: 01/31/2024
products:
  - minecraft
---

# Minecraft Custom Biomes Sample project

This sample demonstrates experimental custom biomes capabilities in preview in Minecraft. First, a sample behavior and resource pack contains some assets: palm trees, white sand, and a Beachager mob. We then have a sample biome pack that places these features inside of the world.

## Attribution:

waves sand beach 017.wav by klankbeeld -- https://freesound.org/s/627702/ -- License: Attribution 4.0 - see also https://freesound.org/people/klankbeeld/

## Prerequisites

**Install Node.js tools, if you haven't already**

We're going to use the package manager [npm](https://www.npmjs.com/package/npm) to get more tools to make the process of building our project easier.

Visit [https://nodejs.org/](https://nodejs.org).

Download the version with "LTS" next to the number and install it. (LTS stands for Long Term Support, if you're curious.) In the Node.js Windows installer, accept the installation defaults. You do not need to install any additional tools for Native compilation.

**Install Visual Studio Code, if you haven't already**

Visit the [Visual Studio Code website](https://code.visualstudio.com) and install Visual Studio Code.

## Getting Started

1. To make your own environment look like the example, create a folder on your `C:\` drive and call it **projects**. Create a subfolder called **chill_oasis**.

1. Put the extracted contents of the chill_oasis_blocks_and_features folder into **chill_oasis**.

1. Open a Windows Terminal or PowerShell window and change the working directory to your **chill_oasis** folder:

   ```powershell
   cd c:\projects\chill_oasis_blocks_and_features\
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

This sample demonstrates how you can build broader , and how you can leverage custom block features and components.

## Manifest

- [chill_oasis_blocks](https://github.com/microsoft/minecraft-samples/blob/main/chill_oasis_blocks_and_features/chill_oasis_blocks): This contains just a set of blocks that implement a palm tree.
- [chill_oasis_blocks_and_features](https://github.com/microsoft/minecraft-samples/blob/main/chill_oasis_blocks_and_features/chill_oasis_blocks_and_features): This contains both the set of blocks a set of blocks that implement a palm tree.
