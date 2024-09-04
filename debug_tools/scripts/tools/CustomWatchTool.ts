import { world } from "@minecraft/server";
import IWatchTool from "../IWatchTool";
import { IToolConfigurationExperience } from "../ITool";

export default class CustomWatchTool implements IWatchTool {
  id: string = "Custom";
  typeId: string = "custom";
  data: string = "";
  info: string = "";
  configurationExperience = IToolConfigurationExperience.dataAsString;

  run() {
    const dt = new Date();

    this.info = this.data + " " + dt.getHours() + ":" + dt.getMinutes() + ":" + dt.getSeconds();
  }

  getConfigurationDataPropertyTitle() {
    return "Custom data";
  }

  getTitle() {
    return "Custom";
  }

  getInfo(): string {
    return this.info;
  }

  getShortInfo(): string {
    return this.getInfo();
  }
}
