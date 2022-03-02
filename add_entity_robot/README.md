---
page_type: sample
author: mammerla
description: A basic Hello World example of adding a new entity in for Minecraft.
ms.author: mikeam@microsoft.com
ms.date: 03/01/2022
languages:
- json
- python
products:
- minecraft
---

# Adding a new entity into Minecraft

This sample demonstrates how to add a new entity into Minecraft. 

See [this article on the Minecraft Creator Portal](https://docs.microsoft.com/minecraft/creator/documents/introductiontoaddentity) for the full walkthrough of how to build this demo.

## Running the sample within Minecraft

Run the following batch file to copy these files into your Minecraft: Bedrock Edition folder.

```powershell
install_uwp.cmd
```

To use the new entities, follow these instructions inside of Minecraft.

1. From Play, select Create New
1. Select Create New World
1. Give your world a title
1. Under Default Game Mode, select Creative
1. Under Resource Packs, and under My Packs, select either Robot Minimal or Robot Full examples.



## Manifest

- [min](https://github.com/microsoft/minecraft-samples/blob/main/add_entity_robot/min/): Minimal starter version of this sample - useful for the start of [the corresponding article](https://docs.microsoft.com/minecraft/creator/documents/introductiontoaddentity) 
- [full](https://github.com/microsoft/minecraft-samples/blob/main/add_entity_robot/full/): Full, completed version of this sample - this should match your project at the end of [the corresponding article](https://docs.microsoft.com/minecraft/creator/documents/introductiontoaddentity) 
- [install_uwp.cmd](https://github.com/microsoft/minecraft-samples/blob/main/add_entity_robot/install_uwp.cmd): Copies these projects into your Minecraft: Bedrock Edition UWP projects folder (`%localappdata%\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\`)