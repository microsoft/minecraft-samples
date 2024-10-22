---
page_type: sample
author: mammerla
description: A basic collection of example features and feature rules for Minecraft.
ms.author: mikeam@microsoft.com
ms.date: 10/09/2024
languages:
  - typescript
products:
  - minecraft
---

# Minecraft Custom Features Project

This sample demonstrates a set of different custom items with different capabilities. Within each subfolder is a behavior pack and a resource pack. These packs can be deployed to Minecraft using NPM.

`basic_orange_ore` - is a very basic "hello world" style feature that will place many geodes full of "orange ore" within a world.
`example_feature_set` - will place a number of different elements within the world. Note that it will place an oversupply of monument elements and apple blocks, so please do not use this within a world.

## Prerequisites

**Install Node.js tools, if you haven't already**

We're going to use the package manager [npm](https://www.npmjs.com/package/npm) to get more tools to make the process of building our project easier.

Visit [https://nodejs.org/](https://nodejs.org).

Download the version with "LTS" next to the number and install it. (LTS stands for Long Term Support, if you're curious.) In the Node.js Windows installer, accept the installation defaults. You do not need to install any additional tools for Native compilation.

**Install Visual Studio Code, if you haven't already**

Visit the [Visual Studio Code website](https://code.visualstudio.com) and install Visual Studio Code.

### Summary

Use `npm run local-deploy` to deploy these features over into Minecraft.

## Manifest

- [basic_orange_ore](https://github.com/microsoft/minecraft-samples/blob/main/custom_features/custom_orange_ore): This contains a simple end to end example of a feature.
- [example_feature_set](https://github.com/microsoft/minecraft-samples/blob/main/custom_features/example_feature_set): A mega pack of many examples of different features and feature rules.
