import { GameMode, system, world } from "@minecraft/server";
import IWatchTool from "../IWatchTool";
import { IToolConfigurationExperience } from "../ITool";

export default class TickWatchTool implements IWatchTool {
  id: string = "tick";
  info: string = "";
  data: string = "";
  typeId: string = "tick";
  configurationExperience = IToolConfigurationExperience.noData;

  run() {
    this.info = system.currentTick.toString();
  }

  getTitle() {
    return this.id;
  }

  getInfo(): string {
    return this.info;
  }

  getShortInfo(): string {
    return this.getInfo();
  }
}
