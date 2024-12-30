import { world, system } from "@minecraft/server";
import GrayWaveManager from "./GrayWaveManager";

const g_gwmn = new GrayWaveManager();
let tickIndex = 0;

function mainTick() {
  tickIndex++;

  if (tickIndex === 100) {
    g_gwmn.init();
    world.sendMessage("Initialized gray wave machines.");
  } else if (tickIndex > 100) {
    g_gwmn.tick(tickIndex);
  }

  system.run(mainTick);
}

system.run(mainTick);
