import { world, system } from "@minecraft/server";

let instanceTick = 0;

function mainTick() {
  if (instanceTick % 100 === 0) {
    world.sendMessage("Hello starter! Current Tick: " + instanceTick);
  }

  instanceTick++;
  system.run(mainTick);
}

system.run(mainTick);
