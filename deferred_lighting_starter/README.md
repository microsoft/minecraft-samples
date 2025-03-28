---
page_type: sample
author: mammerla
description: A simple example of a deferred lighting rendering (preview) resource pack
ms.author: mikeam@microsoft.com
ms.date: 11/15/2023
languages:
  - typescript
products:
  - minecraft
---

# Minecraft Deferred Lighting Rendering

This sample demonstrates foundational settings for configuring deferred lighting features for Deferred Lighting rendering in Minecraft Bedrock Preview.

## Prerequisites

### Install Node.js tools, if you haven't already

We're going to use the Node Package Manager (or NPM) to get more tools to make the process of building our project easier.

Visit [https://nodejs.org/](https://nodejs.org).

Download the version with "LTS" next to the number and install it.

### Install Visual Studio Code, if you haven't already

Visit the [Visual Studio Code website](https://code.visualstudio.com) and install Visual Studio Code.

## Getting Started

1. Using a copy of this starter project from GitHub - you can get a copy of this project by visiting [https://github.com/microsoft/minecraft-samples/](https://github.com/microsoft/minecraft-samples/) and, under the Code button, selecting `Download ZIP`.

1. The `deferred_lighting_starter` folder contains a starter add-on project for Minecraft.

1. To make your own environment look like the example, create a folder on your `C:\` drive and call it **projects**. Create a subfolder called **myaddon**.

1. Put the extracted contents of the Add-on Starter Project folder into **myaddon**.

1. Open a Windows Terminal or PowerShell window and change the working directory to your **myaddon** folder:

   ```powershell
   cd c:\projects\myaddon\
   ```

1. Use NPM to install our tools:

   ```powershell
   npm i
   ```

1. Use this shortcut command to open the project in Visual Studio Code:

   ```powershell
   code .
   ```

It might also ask you to install the Minecraft Debugger and Blockception's Visual Studio Code plugin, which are plugins to Visual Studio Code that can help with Minecraft development. Go ahead and do that, if you haven't already.

### Running the project

To get started, go into PowerShell and navigate to your **C:\projects\myaddon** directory.

Run this command:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Run this one, too.

```powershell
npm run local-deploy
```

### Summary

With this starter, you've seen how to build a resource pack with deferred lighting settings.

## Manifest

-[deferred_lighting_starter](https://github.com/microsoft/minecraft-samples/blob/main/deferred_lighting_starter/): This contains a starter resource pack with some basically configured deferred lighting starter setting JSON files.
