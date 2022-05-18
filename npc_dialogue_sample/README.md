---
page_type: sample
author: docsbryce
description: The sample NPC Dialogue Behavior Pack used in the NPC Dialogue Tutorial.
ms.author: v-bbortree
ms.date: 05/17/2022
languages:
- json
products:
- minecraft
---

# NPC Dialogue Sample

This sample is the behavior pack used in the NPC Dialogue Tutorial.

See the [NPC Dialogue](https://docs.microsoft.com/minecraft/creator/documents/NPCDialogue) documentation for the full walkthrough adding custom dialogue for an NPC.

## Using the NPC Dialogue Behavior Pack Sample

The behavior pack sample is a useful tool to check your work while completing the NPC Dialogue Behavior Pack Tutorial. Using it is as simple as adding it to your `development_behavior_pack` folder.

### Locate the com.mojang folder

1. Press Win+R to open Run.
1. Copy and paste the following into the Open field: `%localappdata%\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang`
1. Click OK.

### Copy NPC Dialogue Behavior Pack sample into the `com.mojang` folder

1. Click `development_behavior_packs`.
1. Copy `npc_dialogue_sample` into the folder.

### Enable the NPC Dialogue Behavior Pack in Minecraft

1. Launch Minecraft and select Play.
1. Select Create New World.
1. Under Settings, scroll down to the Add-Ons section.
1. Click on Behavior Packs to see all available packs.
1. Click the MY PACKS drop-down to open it.
1. Select My NPC Dialogue Behavior Pack and click Activate to add the behavior pack to the world.
1. Click Create to create your world.

Now you can create an NPC named Ducky and receive a very cool item for chatting with them.

## Manifest

- [dialogue/scene.json](https://github.com/microsoft/minecraft-samples/blob/main/npc_dialogue_sample/dialogue/scene.json): This defines the dialogue that an NPC named Ducky will use when you run the command in the NPC Dialogue tutorial.
- [manifest.json](https://github.com/microsoft/minecraft-samples/blob/main/npc_dialogue_sample/manifest.json/): This is the manifest.json folder for the sample behavior pack.
