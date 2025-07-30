import { world, system } from "@minecraft/server";

let curTick = 0;

function mainTick() {
  if (curTick % 20 === 0) {
    world.sendMessage("Hello, world! Current tick: " + curTick);
  }

  curTick++;

  system.run(mainTick);
}

system.run(mainTick);
