import { world, system } from "@minecraft/server";

let tickIndex = 0;

function mainTick() {
  try {
    tickIndex++;

    if (tickIndex === 200) {
      world
        .getDimension("overworld")
        .runCommandAsync(
          "say Welcome to this custom block test! Use the /give command to give yourself a custom block."
        );
    }
  } catch (e) {
    console.warn("Script error: " + e);
  }

  system.run(mainTick);
}

system.run(mainTick);
