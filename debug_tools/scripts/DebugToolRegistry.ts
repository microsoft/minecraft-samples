export const StaticToolTitles = ["Time of Day", "Tick", "Gamemode"];
export const StaticToolIds = ["timeOfDay", "tick", "gamemode"];
export const DynamicToolTitles = ["Dynamic Properties", "Command Results", "Scoreboard", "Location", "Custom"];
export const DynamicToolIds = ["dynamicProperty", "commandResult", "scoreboard", "location", "custom"];

import TimeOfDayWatchTool from "./tools/TimeOfDayWatchTool";
import TickWatchTool from "./tools/TickWatchTool";
import ScoreboardInfoTool from "./tools/ScoreboardWatchTool";
import LocationWatchTool from "./tools/LocationWatchTool";
import CommandResultWatchTool from "./tools/CommandResultWatchTool";
import DynamicPropertyWatchTool from "./tools/DynamicPropertyWatchTool";
import GameModeWatchTool from "./tools/GameModeWatchTool";
import IWatchTool from "./IWatchTool";
import CustomWatchTool from "./tools/CustomWatchTool";

export default class DebugToolRegistry {
  static createToolInstance(typeId: string, id?: string) {
    let tool: IWatchTool | undefined = undefined;

    switch (typeId.toLowerCase()) {
      case "timeofday":
        tool = new TimeOfDayWatchTool();
        break;
      case "tick":
        tool = new TickWatchTool();
        break;
      case "gamemode":
        tool = new GameModeWatchTool();
        break;
      case "scoreboard":
        tool = new ScoreboardInfoTool();
        break;
      case "location":
        tool = new LocationWatchTool();
        break;
      case "commandresult":
        tool = new CommandResultWatchTool();
        break;
      case "dynamicproperty":
        tool = new DynamicPropertyWatchTool();
        break;
      case "custom":
        tool = new CustomWatchTool();
        break;
    }

    if (tool) {
      tool.id = id ? id : typeId;
      tool.typeId = typeId.toLowerCase();
      tool.data = "";
    }

    return tool;
  }
}
