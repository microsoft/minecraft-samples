import { world, system } from "@minecraft/server";
import GrayWaveManager from "./GrayWaveManager";

const g_gwmn = new GrayWaveManager();
let tickIndex = 0;

function mainTick() {
  tickIndex++;

  if (tickIndex === 100) {
    g_gwmn.init();
  } else if (tickIndex > 100) {
    try {
      g_gwmn.tick(tickIndex);
    } catch (e) {
      console.warn(e);
    }
  }

  system.run(mainTick);
}

system.run(mainTick);
