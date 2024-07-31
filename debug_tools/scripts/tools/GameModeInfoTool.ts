import { GameMode, world } from "@minecraft/server";
import IInfoTool from "../IInfoTool";

export default class GameModeInfoTool implements IInfoTool {
  id: string = "GameMode";
  info: string = "";
  typeId: string = "gamemode";
  data: string = "";

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
