---
page_type: sample
author: mammerla
description: A progressive example of an add-on for Minecraft that supports the concept of "dreams" in Minecraft.
ms.author: mikeam@microsoft.com
ms.date: 02/22/2024
languages:
  - typescript
products:
  - minecraft
---

# Minecraft Chill Dreams Add-on

This sample demonstrates a "chill-dreams" an add-on in Minecraft. See [the Minecraft Creator Learning Portal](https://learn.microsoft.com/minecraft/creator/casual) for the web
series behind this article.

 There are three progressive versions:

* `1_dream_turkey` - Content at the end of Part 1: The Dream Turkey.
* (part 2 coming soon)
* `complete` - The full, completed chill-dreams add-on you will see at the end of Part 3

## Prerequisites

### Install Node.js tools, if you haven't already

We're going to use the Node Package Manager (or NPM) to get more tools to make the process of building our project easier.

Visit [https://nodejs.org/](https://nodejs.org).

Download the version with "LTS" next to the number and install it.

### Install Visual Studio Code, if you haven't already

Visit the [Visual Studio Code website](https://code.visualstudio.com) and install Visual Studio Code.

## Getting Started

1. Using a copy of this starter project from GitHub - you can get a copy of this project by visiting [https://github.com/microsoft/minecraft-samples/](https://github.com/microsoft/minecraft-scripting-samples/) and, under the Code button, selecting `Download ZIP`.

1. Choose the part you'd like to use (for example, `chill_dreams/complete`) folder contains the full Chill Dreams Add-on for Minecraft.

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

Chill Dreams demonstrates several techniques for building a thematic Add-On in Minecraft. Please view the series on [the Minecraft Creator Learning Portal](https://learn.microsoft.com/minecraft/creator/casual) for more info.

## Manifest

-[gulpfile.js](https://github.com/microsoft/minecraft-scripting-samples/blob/main/ts-starter/gulpfile.js): This file contains build instructions for Gulp, for building out TypeScript code.
-[scripts](https://github.com/microsoft/minecraft-scripting-samples/blob/main/ts-starter/scripts): This contains all of your TypeScript files, that will be compiled and built into your projects.
-[behavior_packs](https://github.com/microsoft/minecraft-scripting-samples/blob/main/ts-starter/behavior_packs): This contains resources and JSON files that define your behavior pack.
