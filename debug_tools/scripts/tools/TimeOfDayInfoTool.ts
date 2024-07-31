import { GameMode, world } from "@minecraft/server";
import IInfoTool from "../IInfoTool";

export default class TimeOfDayInfoTool implements IInfoTool {
  id: string = "timeOfDay";
  typeId: string = "timeofday";
  data: string = "";
  info: string = "";

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
