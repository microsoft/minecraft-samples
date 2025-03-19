---
page_type: sample
author: mammerla
description: A more extended example of websockets in Minecraft
ms.author: mikeam@microsoft.com
ms.date: 01/31/2024
products:
  - minecraft
---

# Minecraft Websockets Concerts sample

This sample demonstrates using websockets to pass in a signal of the ambient audio level into Minecraft, which can be used to cause various effects to happen.

## Prerequisites

**Install Node.js tools, if you haven't already**

We're going to use the package manager [npm](https://www.npmjs.com/package/npm) to get more tools to make the process of building our project easier.

Visit [https://nodejs.org/](https://nodejs.org).

Download the version with "LTS" next to the number and install it. (LTS stands for Long Term Support, if you're curious.) In the Node.js Windows installer, accept the installation defaults. You do not need to install any additional tools for Native compilation.

**Install "big" Visual Studio Community Edition, if you haven't already**

You will need to use Visual Studio Community Edition or higher to build the webforms example which actually pumps the project.

**Install Visual Studio Code, if you haven't already**

Visit the [Visual Studio Code website](https://code.visualstudio.com) and install Visual Studio Code.

## Getting Started

There are three subfolders with various facets of this project.

* `audio_winforms` is a Visual Studio 2022 project that uses Winforms and more classic .net APIs to capture inbound audio, and push messages in via the /scriptevent command.
* `concert_packs` is a behavior/resource pack in Minecraft that can process the inbound events and provide in-game effects from the audio messages
* `concert_world` is a sample world with the concert arena built out so that you can see how the effects impact.

1. To make your own environment look like the example, create a folder on your `C:\` drive and call it **projects**. Create a subfolder called **concerts**.

1. Put the extracted contents of the concerts folder into **concerts**.

1. Open a Windows Terminal or PowerShell window and change the working directory to your **concerts** folder:

   ```powershell
   cd c:\projects\concerts\
   ```

1. Change into the `concert_packs` folder to install tools

1. Use npm to install our tools:

   ```powershell
   npm i
   ```

1. When that's done, enter:

   ```powershell
   npm run local-deploy
   ```

1. Copy the `concert_world` folder to `%localappdata%\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\minecraftWorlds`. 

1. Open `audio_winforms\AudioWinforms.sln` in Visual Studio, and hit F5 to run it

This will start up the websocket server, and it will become ready to accept connections. Hit the Record button to turn on the Audio interecept.

1. Within Minecraft, you should first ensure that websockets is enabled in the Settings | General Settings panel, and that "Require encryption for websockets" is disabled.

1. Load the concerts world.

1. Within Minecraft, you can connect to your websocket server by typing in `/connect localhost:19190` into the command line.

1. As you make sounds in your local environment, you should see impacts inside of your Minecraft world.

### Summary

This sample demonstrates the foundation of how you can build with websockets in Minecraft.

## Manifest

- [audio_winforms/AudioWinforms.sln](https://github.com/microsoft/minecraft-samples/blob/main/casual_creator/_concerts/audio_winforms/AudioWinforms.sln): This is a Visual Studio 2022 project that hosts a websocket server.
