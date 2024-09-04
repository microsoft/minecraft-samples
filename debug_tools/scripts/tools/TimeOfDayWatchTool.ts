import { world } from "@minecraft/server";
import IWatchTool from "../IWatchTool";
import { IToolConfigurationExperience } from "../ITool";

export default class TimeOfDayWatchTool implements IWatchTool {
  id: string = "timeOfDay";
  typeId: string = "timeofday";
  data: string = "";
  info: string = "";
  configurationExperience = IToolConfigurationExperience.noData;

  run() {
    this.info = world.getTimeOfDay().toString();
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
