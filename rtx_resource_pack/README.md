---
page_type: sample
author: docsbryce
description: The sample RTX resource pack used in the Physically Based Rendering Workflow.
ms.author: v-bbortree
ms.date: 03/21/2022
languages:
- json
products:
- minecraft
---

# RTX Resource Pack

This sample is the resource pack used in the Physically Based Rendering Workflow tutorial.

See the [Physically Based Rendering Workflow](https://docs.microsoft.com/minecraft/creator/documents/rtxpbrtutorial) documentation for the full walkthrough of creating a new RTX texture.

## Using the RTX Sample Resource Pack

The RTX Sample Resource Pack is a useful tool to check your work while completing the Physically Based Rendering Workflow. Using it is as simple as adding it to your `development_resource_pack` folder.

### Locate the com.mojang folder

1. Press Win+R to open Run.
1. Copy and paste the following into the Open field: `%localappdata%\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang`
1. Click OK.

### Copy RTX Sample Resource Pack into the folder

1. Click `development_resource_packs`.
1. Copy `RTX Sample Resource Pack` into the folder.

### Enable the Resource Pack in Minecraft

1. Launch Minecraft and select Play.
1. Select Create New World.
1. Under Settings, scroll down to the Add-Ons section.
1. Click on Resource Packs to see all available packs.
1. Click the MY PACKS drop-down to open it.
1. Select My RESOURCE Pack and click Activate to add the resource pack to the world.
1. Click Create to create your world.


You can now give yourself concrete blocks, emerald ore, or an iron block to test the various texture affects used throughout the tutorial.


## Manifest

- [textures/blocks](https://github.com/microsoft/minecraft-samples/blob/main/rtx_resource_pack/textures/blocks): These are the textures, texture_set JSON, and blocks used throughout the PBR sample.
- [manifest.json](https://github.com/microsoft/minecraft-samples/blob/main/rtx_resource_pack/manifest.json/): This is the manifest.json folder with the raytraced capability on.
