import { world } from "@minecraft/server";
import IWatchTool from "../IWatchTool";
import { IToolConfigurationExperience } from "../ITool";

export default class GameModeWatchTool implements IWatchTool {
  id: string = "gamemode";
  info: string = "";
  typeId: string = "gamemode";
  data: string = "";

  configurationExperience = IToolConfigurationExperience.noData;

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

  getConfigurationDataPropertyTitle() {
    return "Game mode";
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
