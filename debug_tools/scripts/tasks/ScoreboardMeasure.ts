import { GameMode, world } from "@minecraft/server";
import IInfoTask from "../IInfoTask";

export default class ScoreboardMeasure implements IInfoTask {
  id: string = "Scoreboard";
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
