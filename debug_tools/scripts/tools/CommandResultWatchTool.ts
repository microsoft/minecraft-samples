import { world } from "@minecraft/server";
import { IToolConfigurationExperience } from "../ITool";
import IWatchTool from "../IWatchTool";

export default class CommandResultWatchTool implements IWatchTool {
  id: string = "commandResult";
  typeId: string = "commandResult";
  data: string = "";
  info: string = "";
  configurationExperience = IToolConfigurationExperience.dataAsString;

  run() {
    if (this.data.length > 4) {
      const result = world.getDimension("overworld").runCommand(this.data);

      if (result && result.successCount !== undefined) {
        this.info = result.successCount.toString();
      } else {
        this.info = "NR";
      }
    } else {
      this.info = "";
    }
  }

  getConfigurationDataPropertyTitle() {
    return "Command";
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
