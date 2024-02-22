import { world, system, Player, ItemStartUseAfterEvent, ItemStopUseAfterEvent } from "@minecraft/server";

let tickCount = 0;

let tickTurkeyStartEating = -1;

function mainLoop() {
  if (tickCount === 60) {
    initializeWorld();
  }

  tickCount++;
  system.run(mainLoop);
}

function initializeWorld() {
  // turn off command feedback
  world.getDimension("overworld").runCommand("gamerule sendcommandfeedback false");
}

function startAfterItemUse(event: ItemStartUseAfterEvent) {
  if (!event.source || event.source.typeId !== "minecraft:player") {
    return;
  }

  if (event.itemStack.typeId === "mamm_cds:cooked_dream_turkey") {
    tickTurkeyStartEating = tickCount;
  }
}

function stopAfterItemUse(event: ItemStopUseAfterEvent) {
  if (!event.source || event.source.typeId !== "minecraft:player") {
    return;
  }

  if (event.itemStack && event.itemStack.typeId === "mamm_cds:cooked_dream_turkey") {
    // UH OH GETTING SLEEPY
    if (tickCount - tickTurkeyStartEating > 60 && event.source && event.source.typeId === "minecraft:player") {
      startDreamSleep(event.source as Player);
    }
  }
}

function startDreamSleep(player: Player) {
  player.onScreenDisplay.setActionBar("§oYou're getting sleepy...§r");
  player.onScreenDisplay.setTitle(" ", {
    fadeInDuration: 20,
    fadeOutDuration: 20,
    stayDuration: 100,
  });

  player.camera.fade({
    fadeColor: { red: 0, green: 0, blue: 0 },
    fadeTime: {
      fadeInTime: 3,
      fadeOutTime: 3,
      holdTime: 10,
    },
  });
}

world.afterEvents.itemStartUse.subscribe(startAfterItemUse);
world.afterEvents.itemStopUse.subscribe(stopAfterItemUse);

system.run(mainLoop);
