---
page_type: sample
author: mammerla
description: A progressive example starting from a basic add-on with nothing in it (useful as a starter) - through an add-on with some mobs and into advanced logic.
ms.author: mikeam@microsoft.com
ms.date: 11/15/2023
languages:
  - typescript
products:
  - minecraft
---

# Minecraft Add-on Start project

This sample demonstrates everything you need to have an add-on in Minecraft. There are three versions and progressions:

* `start` is a foundational starter project. It comes with a gulp-based workflow tool 
* `1 - hello world` is a basic entity that will show you that your add-on is working. It comes a mob that overrides the default cow in Minecraft
* `2 - entities` adds a set of entities (from the MCLive2022 add-on pack to the add-on)
* `3 - full` adds more functionality and scripts to the add-on

## Prerequisites

### Install Node.js tools, if you haven't already

We're going to use the Node Package Manager (or NPM) to get more tools to make the process of building our project easier.

Visit [https://nodejs.org/](https://nodejs.org).

Download the version with "LTS" next to the number and install it.

### Install Visual Studio Code, if you haven't already

Visit the [Visual Studio Code website](https://code.visualstudio.com) and install Visual Studio Code.

## Getting Started

1. Using a copy of this starter project from GitHub - you can get a copy of this project by visiting [https://github.com/microsoft/minecraft-samples/](https://github.com/microsoft/minecraft-scripting-samples/) and, under the Code button, selecting `Download ZIP`.

1. The `addon_starter/start` folder contains a starter add-on project for Minecraft.

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

1. When that's done, enter:

    ```powershell
    npm i gulp-cli --global
    ```

1. Use this shortcut command to open the project in Visual Studio Code:

    ```powershell
    code .
    ```

It might also ask you to install the Minecraft Debugger and Blockception's Visual Studio Code plugin, which are plugins to Visual Studio Code that can help with Minecraft development. Go ahead and do that, if you haven't already.

### Summary

With this starter, you've seen how to build a nice little add-on.


## Manifest

-[gulpfile.js](https://github.com/microsoft/minecraft-scripting-samples/blob/main/ts-starter/gulpfile.js): This file contains build instructions for Gulp, for building out TypeScript code.
-[scripts](https://github.com/microsoft/minecraft-scripting-samples/blob/main/ts-starter/scripts): This contains all of your TypeScript files, that will be compiled and built into your projects.
-[behavior_packs](https://github.com/microsoft/minecraft-scripting-samples/blob/main/ts-starter/behavior_packs): This contains resources and JSON files that define your behavior pack.
