import { world, system } from "@minecraft/server";

let tickIndex = 0;

function mainTick() {
  try {
    tickIndex++;

    if (tickIndex === 200) {
      world.sendMessage(
        "Welcome to this palm tree test! Use the §h/give @s mike:...§r  command to give yourself a custom block."
      );
    }
  } catch (e) {
    console.warn("Script error: " + e);
  }

  system.run(mainTick);
}

system.run(mainTick);
