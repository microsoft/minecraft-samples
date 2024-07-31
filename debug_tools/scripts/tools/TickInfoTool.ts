import { GameMode, system, world } from "@minecraft/server";
import IInfoTool from "../IInfoTool";

export default class TickInfoTool implements IInfoTool {
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
