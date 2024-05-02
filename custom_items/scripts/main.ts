import { world, system } from "@minecraft/server";

let tickIndex = 0;

function mainTick() {
  try {
    tickIndex++;

    if (tickIndex === 200) {
      world.sendMessage("Welcome to this custom item test! Use the §h/give @s demo:...§r command to give yourself a custom item.");
    }
  } catch (e) {
    console.warn("Script error: " + e);
  }

  system.run(mainTick);
}

system.run(mainTick);
