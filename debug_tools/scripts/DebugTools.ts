import { system, world } from "@minecraft/server";
import IDebugToolsData from "./IDebugToolsData";
import TimeOfDayWatchTool from "./tools/TimeOfDayWatchTool";
import IWatchTool from "./IWatchTool";
import TickWatchTool from "./tools/TickWatchTool";
import ScoreboardInfoTool from "./tools/ScoreboardWatchTool";
import LocationWatchTool from "./tools/LocationWatchTool";
import IToolData from "./IToolData";
import CommandResultWatchTool from "./tools/CommandResultWatchTool";
import DynamicPropertyWatchTool from "./tools/DynamicPropertyWatchTool";
import GameModeWatchTool from "./tools/GameModeWatchTool";

export const StaticToolTitles = ["Time of Day", "Tick", "Gamemode"];
export const StaticToolIds = ["timeOfDay", "tick", "gamemode"];
export const DynamicToolTitles = ["Dynamic Properties", "Command Results", "Scoreboard", "Location"];
export const DynamicToolIds = ["dynamicProperty", "commandResult", "scoreboard", "location"];

export default class DebugTools {
  _sessionTick: number = 0;
  _log: ((message: string) => void) | undefined = undefined;

  notifyDisplayDataUpdatedList: (() => void)[] = [];

  data: IDebugToolsData = {
    tools: [],
    displayInSubHeader: false,
    displayConsoleWarning: false,
    displayIngameMessage: false,
    displayScoreboard: false,
  };

  _tools: IWatchTool[] = [];

  get tools() {
    return this._tools;
  }

  get toolsData() {
    return this.data.tools;
  }

  get displayInSubHeader() {
    return this.data.displayInSubHeader;
  }

  set displayInSubHeader(newVal: boolean) {
    this.data.displayInSubHeader = newVal;
    this.save();
  }

  get displayConsoleWarning() {
    return this.data.displayConsoleWarning;
  }

  set displayConsoleWarning(newVal: boolean) {
    this.data.displayConsoleWarning = newVal;
    this.save();
  }

  get displayScoreboard() {
    return this.data.displayScoreboard;
  }

  set displayScoreboard(newVal: boolean) {
    this.data.displayScoreboard = newVal;
    this.save();
  }

  get displayIngameMessage() {
    return this.data.displayIngameMessage;
  }

  set displayIngameMessage(newVal: boolean) {
    this.data.displayIngameMessage = newVal;
    this.save();
  }

  constructor() {
    this.tick = this.tick.bind(this);
  }

  getToolById(toolId: string) {
    for (const toolData of this.tools) {
      if (toolData.id === toolId) {
        return toolData;
      }
    }

    return undefined;
  }

  getToolDataById(toolId: string) {
    for (const toolData of this.toolsData) {
      if (toolData.id === toolId) {
        return toolData;
      }
    }

    return undefined;
  }

  hasToolById(toolId: string) {
    for (const toolData of this.toolsData) {
      if (toolData.id === toolId) {
        return true;
      }
    }

    return false;
  }

  ensureToolByTypeId(toolTypeId: string) {
    if (this.hasToolById(toolTypeId)) {
      return;
    }

    this.toolsData.push({
      id: toolTypeId,
      typeId: toolTypeId,
      data: "",
    });

    this.applyToolSetChange();
    this.save();

    this.notifyDisplayDataUpdated();
  }

  static createRandomId(length: number) {
    let id = "";

    for (let i = 0; i < length; i++) {
      const main = Math.random() * 6;

      if (main < 1) {
        id += String.fromCharCode(Math.floor(Math.random() * 10) + 48);
      } else if (main < 4) {
        id += String.fromCharCode(Math.floor(Math.random() * 26) + 65);
      } else {
        id += String.fromCharCode(Math.floor(Math.random() * 26) + 97);
      }
    }

    return id;
  }

  getNewToolId(toolTypeId: string) {
    if (!this.hasToolById(toolTypeId)) {
      return toolTypeId;
    }

    let inc = 1;

    while (this.hasToolById(toolTypeId + " " + inc)) {
      inc++;
    }

    return toolTypeId + " " + inc;
  }

  addTool(toolTypeId: string) {
    this.toolsData.push({
      id: this.getNewToolId(toolTypeId),
      typeId: toolTypeId,
      data: "",
    });

    this.applyToolSetChange();
    this.save();

    this.notifyDisplayDataUpdated();

    return this.getToolById(toolTypeId);
  }

  removeToolById(toolId: string) {
    const newArr: IToolData[] = [];

    for (const tool of this.toolsData) {
      if (tool.id !== toolId) {
        newArr.push(tool);
      }
    }

    this.data.tools = newArr;

    this.applyToolSetChange();
    this.save();

    this.notifyDisplayDataUpdated();
  }

  log(message: string) {
    if (this._log) {
      this._log(message);
    }
  }

  init() {
    this.load();
    this.applyToolSetChange();

    system.run(this.tick);
  }

  createToolInstance(typeId: string, id?: string) {
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
    }

    if (tool) {
      tool.id = id ? id : typeId;
      tool.typeId = typeId.toLowerCase();
      tool.data = "";
    }

    return tool;
  }

  applyToolSetChange() {
    const newTools: IWatchTool[] = [];

    for (const taskData of this.data.tools) {
      let tool: IWatchTool | undefined = undefined;

      for (const existingTool of this._tools) {
        if (existingTool.id === taskData.id) {
          tool = existingTool;
        }
      }

      if (tool === undefined) {
        tool = this.createToolInstance(taskData.typeId, taskData.id);
      }

      if (tool) {
        newTools.push(tool);
      }
    }

    this._tools = newTools;
  }

  load() {
    const stateStr = world.getDynamicProperty("cc_debug:data");

    if (stateStr && typeof stateStr === "string") {
      try {
        const newObj = JSON.parse(stateStr);

        if (newObj) {
          this.data = newObj;
        }
      } catch (e) {}
    }
  }

  save() {
    const stateStr = JSON.stringify(this.data);

    for (const tool of this._tools) {
      const toolData = this.getToolDataById(tool.id);

      if (toolData) {
        toolData.data = tool.data;
      }
    }

    world.setDynamicProperty("cc_debug:data", stateStr);
  }

  tick() {
    this._sessionTick++;

    if (this._sessionTick % 5 === 0) {
      for (const tool of this._tools) {
        tool.run();
      }

      this.notifyDisplayDataUpdated();
    }

    system.run(this.tick);
  }

  notifyDisplayDataUpdated() {
    for (const fn of this.notifyDisplayDataUpdatedList) {
      fn();
    }
  }
}
