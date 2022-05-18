---
page_type: sample
author: docsbryce
description: The sample Behavior Pack used in the Behavior Packs Tutorial.
ms.author: v-bbortree
ms.date: 05/17/2022
languages:
- json
products:
- minecraft
---

# Behavior Pack Sample

This sample is the behavior pack used in the Behavior Pack Tutorial.

See the [Intro to Behavior Packs](https://docs.microsoft.com/minecraft/creator/documents/behaviorpack) documentation for a full tutorial on creating an aggressive cow using a behavior pack.

## Using the Behavior Pack Sample

The behavior pack sample is a useful tool to check your work while completing the Behavior Pack Tutorial. Using it is as simple as adding it to your `development_behavior_pack` folder.

### Locate the com.mojang folder

1. Press Win+R to open Run.
1. Copy and paste the following into the Open field: `%localappdata%\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang`
1. Click OK.

### Copy Behavior Pack sample into the `com.mojang` folder

1. Click `development_behavior_packs`.
1. Copy `behavior_pack_sample` into the folder.

### Enable the Behavior Pack in Minecraft

1. Launch Minecraft and select Play.
1. Select Create New World.
1. Under Settings, scroll down to the Add-Ons section.
1. Click on Behavior Packs to see all available packs.
1. Click the MY PACKS drop-down to open it.
1. Select My Behavior Pack and click Activate to add the behavior pack to the world.
1. Click Create to create your world.

You now have aggressive cows in your world (for better or worse). Good luck!

## Manifest

- [entities/cow.json](https://github.com/microsoft/minecraft-samples/blob/main/behavior_pack_sample/entities/cow.json): This is a modified cow entity programmed with aggressive behavior.
- [manifest.json](https://github.com/microsoft/minecraft-samples/blob/main/behavior_pack_sample/manifest.json/): This is the manifest.json folder for the sample behavior pack.
