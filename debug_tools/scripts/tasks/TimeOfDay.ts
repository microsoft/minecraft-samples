import { GameMode, world } from "@minecraft/server";
import IInfoTask from "../IInfoTask";

export default class TimeOfDay implements IInfoTask {
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
