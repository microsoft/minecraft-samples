import { world } from "@minecraft/server";
import IWatchTool from "../IWatchTool";
import { IToolConfigurationExperience } from "../ITool";
import Utilities from "../Utilities";

export default class LocationWatchTool implements IWatchTool {
  id: string = "Location";
  typeId: string = "location";
  data: string = "";
  info: string = "";

  configurationExperience = IToolConfigurationExperience.dataAsLocation;

  run() {
    let pos = Utilities.getLocationFromString(this.data);
    const dim = world.getDimension("overworld");

    const block = dim.getBlock(pos);

    let loc = "";

    if (block) {
      loc = block.typeId;

      const es = dim.getEntities({
        location: block.location,
        maxDistance: 4,
        minDistance: 0,
      });

      loc += " " + es.length;

      if (es.length > 0) {
        loc += ": " + es[0].typeId;
      }

      if (es.length > 1) {
        loc += ", " + es[1].typeId;
      }
    } else {
      loc = "unloaded";
    }

    this.info = loc;
  }

  getConfigurationDataPropertyTitle() {
    return "Location";
  }

  getTitle() {
    return "@" + this.data;
  }

  getInfo(): string {
    return this.info;
  }

  getShortInfo(): string {
    return this.getInfo();
  }
}
