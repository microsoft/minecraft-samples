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

*[Part 1: Dream Turkey](https://github.com/microsoft/minecraft-samples/blob/main/casual_creator/chill_dreams/1_dream_turkey/): This contains project files that correspond to [part 1 of the blog series](https://learn.microsoft.com/minecraft/creator/casual/chilldreamspart1thedreamturkey)
*[Part 2: Dreams Come True](https://github.com/microsoft/minecraft-samples/blob/main/casual_creator/chill_dreams/2_dreams_come_true/): This contains project files that correspond to [part 2 of the blog series](https://learn.microsoft.com/minecraft/creator/casual/chilldreamspart2makingdreamscometrue)
*[Complete](https://github.com/microsoft/minecraft-samples/blob/main/casual_creator/chill_dreams/complete/): This contains project files that correspond to [part 3 of the blog series](https://learn.microsoft.com/minecraft/creator/casual/chilldreamspart3smellslikememories)

## Prerequisites

### Install Node.js tools, if you haven't already

We're going to use the Node Package Manager (or NPM) to get more tools to make the process of building our project easier.

Visit [https://nodejs.org/](https://nodejs.org).

Download the version with "LTS" next to the number and install it.

### Install Visual Studio Code, if you haven't already

Visit the [Visual Studio Code website](https://code.visualstudio.com) and install Visual Studio Code.

## Getting Started


1. Using a copy of this starter project from GitHub - you can get a copy of this project by visiting [https://github.com/microsoft/minecraft-samples/](https://github.com/microsoft/minecraft-samples/) and, under the Code button, selecting `Download ZIP`.

1. The `casual_creator/chill_dreams` folder contains different stages of the chill dreams project for Minecraft. Use the subfolder of the phase you want to start with.

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

### Summary

Chill Dreams demonstrates several techniques for building a thematic Add-On in Minecraft. Please view the series on [the Minecraft Creator Learning Portal](https://learn.microsoft.com/minecraft/creator/casual) for more info.

## Manifest

-[1_dream_turkey](https://github.com/microsoft/minecraft-samples/blob/main/casual_creator/chill_dreams/1_dream_turkey/): This contains project files that correspond to [part 1 of the blog series](https://learn.microsoft.com/minecraft/creator/casual/chilldreamspart1thedreamturkey)
-[2_dreams_come_true](https://github.com/microsoft/minecraft-samples/blob/main/casual_creator/chill_dreams/2_dreams_come_true/): This contains project files that correspond to [part 2 of the blog series](https://learn.microsoft.com/minecraft/creator/casual/chilldreamspart2makingdreamscometrue)
-[complete](https://github.com/microsoft/minecraft-samples/blob/main/casual_creator/chill_dreams/complete/): This contains project files that correspond to [part 3 of the blog series](https://learn.microsoft.com/en-us/minecraft/creator/casual/chilldreamspart3smellslikememories)
