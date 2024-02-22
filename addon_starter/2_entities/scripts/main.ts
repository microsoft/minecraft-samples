import { world, system } from "@minecraft/server";

function mainTick() {
  if (system.currentTick % 100 === 0) {
    world.sendMessage("Hello starter! Tick: " + system.currentTick);
  }

  system.run(mainTick);
}

system.run(mainTick);
