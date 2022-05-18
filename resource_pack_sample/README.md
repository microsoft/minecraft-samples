---
page_type: sample
author: docsbryce
description: The sample Resource Pack used in the Resource Packs Tutorial.
ms.author: v-bbortree
ms.date: 05/17/2022
languages:
- json
products:
- minecraft
---

# Resource Pack Sample

This sample is the resource pack used in the Intro to Resource Packs Tutorial.

See the [Intro to Resource Packs](https://docs.microsoft.com/minecraft/creator/documents/resourcepack) documentation for the full walkthrough creating an aggressive cow using a resource pack.

## Using the Resource Pack Sample

The resource pack sample is a useful tool to check your work while completing the Resource Pack Tutorial. Using it is as simple as adding it to your `development_resource_pack` folder.

### Locate the com.mojang folder

1. Press Win+R to open Run.
1. Copy and paste the following into the Open field: `%localappdata%\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang`
1. Click OK.

### Copy Resource Pack sample into the `com.mojang` folder

1. Click `development_resource_packs`.
1. Copy `resource_pack_sample` into the folder.

### Enable the Resource Pack in Minecraft

1. Launch Minecraft and select Play.
1. Select Create New World.
1. Under Settings, scroll down to the Add-Ons section.
1. Click on Resource Packs to see all available packs.
1. Click the MY PACKS drop-down to open it.
1. Select My Resource Pack and click Activate to add the resource pack to the world.
1. Click Create to create your world.

Your plain dirt blocks are now bright green. Neat!

## Manifest

- [textures/blocks/dirt.png](https://github.com/microsoft/minecraft-samples/blob/main/resource_pack_sample/textures/blocks/dirt.jpg): A new bright green dirt texture to modify the existing blocks in your world.
- [manifest.json](https://github.com/microsoft/minecraft-samples/blob/main/resource_pack_sample/manifest.json/): This is the manifest.json folder for the sample resource pack.
