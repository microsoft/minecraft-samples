---
page_type: sample
author: mammerla
description: A basic example of using new culled block features within Minecraft 1.20.60 and beyond.
ms.author: mikeam@microsoft.com
ms.date: 01/31/2024
products:
  - minecraft
---

# Minecraft Block Culling Sample Starter Project

This sample demonstrates new block culling and rendering options for custom blocks.

## Getting Started

1. To make your own environment look like the example, create a folder on your `C:\` drive and call it **projects**. Create a subfolder called **culled_blocks**.

1. Put the extracted contents of the culled_block_sample folder into **culled_blocks**.

1. Open a Windows Terminal or PowerShell window and change the working directory to your **culled_blocks** folder:

   ```powershell
   cd c:\projects\culled_blocks\
   ```

1. You can use the install_uwp command to copy over the culled_block_sampes:

   ```powershell
   install_uwp.cmd
   ```

Or copy the files to %localappdata%\packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\development_behavior_packs
and %localappdata%\packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\development_resource_packs respectively.

It might also ask you to install the Minecraft Debugger and Blockception's Visual Studio Code plugin, which are plugins to Visual Studio Code that can help with Minecraft development. Go ahead and do that, if you haven't already.

# Minecraft Block Culling Usage In Game

This sample demonstrates how to use block culling on the **tuna_roll** custom block. 

After downloading these add-on packs:

1. Insert UUIDs in the manifests.
1. Put them in their respective folders in your com.mojang folder.
1. Make a creative Minecraft world.
1. `/give @s demo:tuna_roll`
1. Place 3 tuna roll blocks.
1. Replace the center block with a full-sized block like "acacia planks".
1. You will see the geometry of the tuna roll blocks change.

### Summary

This sample demonstrates how to use block culling on the **tuna_roll** custom block.

## Manifest

- [culled_block_behavior_pack](https://github.com/microsoft/minecraft-samples/blob/main/culled_block_sample/culled_block_behavior_pack): This contains behaviors for the custom blocks used in this sample.
- [culled_block_resource_pack](https://github.com/microsoft/minecraft-samples/blob/main/culled_block_sample/culled_resource_pack): This contains resources and JSON files -- including block culling - that define a resource pack.
