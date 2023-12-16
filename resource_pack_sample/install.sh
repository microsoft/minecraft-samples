#!/usr/bin/env bash

devFolder=/mnt/c/Users/jerem/AppData/Local/Packages/Microsoft.MinecraftUWP_8wekyb3d8bbwe/LocalState/games/com.mojang/development_resource_packs
packName=My_RESOURCE_Pack

if [ ! -f "manifest.json" ];then
  echo "manifest.json not found in $PWD, refusing to copy files."
  exit
fi

echo "Installing mod to $devFolder/$packName"
mkdir $devFolder/$packName
cp -r textures manifest.json pack_icon.png $devFolder/$packName