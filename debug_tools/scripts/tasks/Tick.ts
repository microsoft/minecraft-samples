import { GameMode, system, world } from "@minecraft/server";
import IInfoTask from "../IInfoTask";

export default class Tick implements IInfoTask {
  id: string = "tick";
  info: string = "";
  data: string = "";
  typeId: string = "tick";

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
