import { world } from "@minecraft/server";
import IWatchTool from "../IWatchTool";
import { IToolConfigurationExperience } from "../ITool";

export default class LocationWatchTool implements IWatchTool {
  id: string = "Location";
  typeId: string = "location";
  data: string = "";
  info: string = "";

  configurationExperience = IToolConfigurationExperience.dataAsLocation;

  run() {
    let scoreBoard = "";

    const obj = world.scoreboard.getObjective(this.data);

    if (obj) {
      for (const sci of obj.getScores()) {
        if (scoreBoard.length > 2) {
          scoreBoard += ",";
        }
        scoreBoard += sci.participant.displayName + "=" + sci.score;
      }
    }

    this.info = scoreBoard;
  }

  getConfigurationDataPropertyTitle() {
    return "Location";
  }

  getTitle() {
    return "s|" + this.id;
  }

  getInfo(): string {
    return this.info;
  }

  getShortInfo(): string {
    return this.getInfo();
  }
}
