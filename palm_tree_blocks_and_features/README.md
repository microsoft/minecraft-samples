---
page_type: sample
author: mammerla
description: A basic progressive example of using custom block features within Minecraft.
ms.author: mikeam@microsoft.com
ms.date: 01/31/2024
products:
  - minecraft
---

# Minecraft Sample Block + Custom Features Project

This sample demonstrates how to create a new tree type that is distributed throughout the overworld. First, a sample feature shows how to use 6 different blocks to assemble a palm tree. For a video on this, see https://www.youtube.com/watch?v=bCU8UxIZ-U4. Then, we're going to create a set of structures that package together different variants of a palm tree, and use Features to distribute them within a particular feature.

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
   cd c:\projects\palm_tree_blocks_and_features\
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

- [palm_tree_blocks](https://github.com/microsoft/minecraft-samples/blob/main/palm_tree_blocks_and_features/palm_tree_blocks): This contains just a set of blocks that implement a palm tree.
- [palm_tree_blocks_and_features](https://github.com/microsoft/minecraft-samples/blob/main/palm_tree_blocks_and_features/palm_tree_blocks_and_features): This contains both the set of blocks  a set of blocks that implement a palm tree.
