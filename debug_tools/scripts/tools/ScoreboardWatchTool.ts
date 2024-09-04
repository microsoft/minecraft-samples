import { world } from "@minecraft/server";
import IWatchTool from "../IWatchTool";
import { IToolConfigurationExperience } from "../ITool";

export default class ScoreboardWatchTool implements IWatchTool {
  id: string = "Scoreboard";
  typeId: string = "scoreboard";
  data: string = "";
  info: string = "";
  configurationExperience = IToolConfigurationExperience.dataAsString;

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
    return "Scoreboard objective name";
  }

  getTitle() {
    return "sbd|" + this.data;
  }

  getInfo(): string {
    return this.info;
  }

  getShortInfo(): string {
    return this.getInfo();
  }
}
