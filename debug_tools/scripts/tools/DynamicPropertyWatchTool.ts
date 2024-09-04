import { IToolConfigurationExperience } from "../ITool";
import IWatchTool from "../IWatchTool";

export default class DynamicPropertyWatchTool implements IWatchTool {
  id: string = "dynamicProperty";
  typeId: string = "dynamicProperty";
  data: string = "";
  info: string = "";
  configurationExperience = IToolConfigurationExperience.dataAsString;

  run() {
    this.info = "dynprop" + this.id;
  }

  getConfigurationDataPropertyTitle() {
    return "Dynamic Property";
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
