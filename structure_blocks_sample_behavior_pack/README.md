---
page_type: sample
author: docsbryce
description: The sample Structure Blocks behavior pack used in the Structure Blocks Tutorial.
ms.author: v-bbortree
ms.date: 04/13/2022
languages:
- json
products:
- minecraft
---

# Structure Blocks Sample Behavior Pack

This sample is the behavior pack used in the Structure Blocks Tutorial.

See the [Structure Blocks Tutorial](https://docs.microsoft.com/minecraft/creator/documents/structureblockstutorial) documentation for the full walkthrough of using structure blocks and the `/structure` command to place buildings.

## Using the Structure Blocks behavior pack

The Structure Blocks behavior pack is a useful tool to check your work while completing the Structure Blocks Tutorial. Using it is as simple as adding it to your `development_behavior_pack` folder.

### Locate the com.mojang folder

1. Press Win+R to open Run.
1. Copy and paste the following into the Open field: `%localappdata%\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang`
1. Click OK.

### Copy Structure Blocks behavior pack into the `com.mojang` folder

1. Click `development_behavior_packs`.
1. Copy `Structure Blocks behavior pack` into the folder.

### Enable the Behavior Pack in Minecraft

1. Launch Minecraft and select Play.
1. Select Create New World.
1. Under Settings, scroll down to the Add-Ons section.
1. Click on behavior Packs to see all available packs.
1. Click the MY PACKS drop-down to open it.
1. Select Structure Blocks Sample Behavior Pack and click Activate to add the behavior pack to the world.
1. Click Create to create your world.

You now have several precreated structures to practice saving, loading, and animating. Feel free to make your own as well!

## Manifest

- [structures](https://github.com/microsoft/minecraft-samples/blob/main/structure_blocks_sample_behavior_pack/structures): These are three sample buildings and a statue to use throughout the tutorial.
- [manifest.json](https://github.com/microsoft/minecraft-samples/blob/main/structure_blocks_sample_behavior_pack/manifest.json/): This is the manifest.json folder for the sample behavior pack.
