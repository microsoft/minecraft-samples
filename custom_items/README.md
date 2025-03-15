---
page_type: sample
author: mammerla
description: A basic collection of custom Minecraft items.
ms.author: mikeam@microsoft.com
ms.date: 04/01/2022
languages:
  - typescript
products:
  - minecraft
---

# Minecraft Custom Items Demo Project

This sample demonstrates a set of different custom items with different capabilities.

## Prerequisites

**Install Node.js tools, if you haven't already**

We're going to use the package manager [npm](https://www.npmjs.com/package/npm) to get more tools to make the process of building our project easier.

Visit [https://nodejs.org/](https://nodejs.org).

Download the version with "LTS" next to the number and install it. (LTS stands for Long Term Support, if you're curious.) In the Node.js Windows installer, accept the installation defaults. You do not need to install any additional tools for Native compilation.

**Install Visual Studio Code, if you haven't already**

Visit the [Visual Studio Code website](https://code.visualstudio.com) and install Visual Studio Code.

### Summary

This a complete example of building multiple different types of items with various different visual representations, in Minecraft.

You can get started with this sample on MCTools! Visit [mctools.dev](https://mctools.dev) to create a new project based on this sample.

## Getting Started

1. To make your own environment look like the example, create a folder on your `C:\` drive and call it **projects**. Create a subfolder called **custom_items**.

1. Put the extracted contents of the custom_blocks folder into **custom_items**.

1. Open a Windows Terminal or PowerShell window and change the working directory to your **custom_items** folder:

   ```powershell
   cd c:\projects\custom_items\
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

## Manifest

- [behavior_packs/custom_item](https://github.com/microsoft/minecraft-samples/blob/main/custom_items/behavior_packs/custom_item): This contains behavior implementations for a set of custom items.
- [resource_packs/custom_item](https://github.com/microsoft/minecraft-samples/blob/main/custom_items/resource_packs/custom_item): This contains resources for a set of custom items.
