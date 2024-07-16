import { GameMode, world } from "@minecraft/server";
import IInfoTask from "../IInfoTask";

export default class GlobalGameMode implements IInfoTask {
  id: string = "PlayerGameMode";
  info: string = "";

  run() {
    let gameModes = "";

    for (const player of world.getAllPlayers()) {
      if (gameModes.length > 0) {
        gameModes += ",";
      }

      gameModes += player.getGameMode().toString();
    }

    this.info = gameModes;
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
