import { GameMode, world } from "@minecraft/server";
import IInfoTool from "../IInfoTool";

export default class ScoreboardInfoTask implements IInfoTool {
  id: string = "Scoreboard";
  typeId: string = "scoreboard";
  data: string = "";
  info: string = "";

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

  getTitle() {
    return "s|" + this.data;
  }

  getInfo(): string {
    return this.info;
  }

  getShortInfo(): string {
    return this.getInfo();
  }
}
