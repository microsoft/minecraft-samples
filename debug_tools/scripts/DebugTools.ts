import { system, world } from "@minecraft/server";
import IDebugToolsData from "./IDebugToolsData";
import TimeOfDayInfoTool from "./tools/TimeOfDayInfoTool";
import IInfoTool from "./IInfoTool";
import TickInfoTool from "./tools/TickInfoTool";
import ScoreboardInfoTool from "./tools/ScoreboardInfoTool";
import LocationInfoTool from "./tools/LocationInfoTool";
import IToolData from "./IToolData";

export const StaticDisplayTaskIds = ["timeOfDay", "tick"];

export default class DebugTools {
  _sessionTick: number = 0;
  _log: ((message: string) => void) | undefined = undefined;

  notifyDisplayDataUpdatedList: (() => void)[] = [];

  data: IDebugToolsData = {
    tools: [],
    displayInSubHeader: false,
  };

  _tools: IInfoTool[] = [];

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

  constructor() {
    this.tick = this.tick.bind(this);
  }

  getToolById(toolId: string) {
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
    let tool: IInfoTool | undefined = undefined;

    switch (typeId.toLowerCase()) {
      case "timeofday":
        tool = new TimeOfDayInfoTool();
        break;
      case "tick":
        tool = new TickInfoTool();
        break;
      case "scoreboard":
        tool = new ScoreboardInfoTool();
        break;
      case "location":
        tool = new LocationInfoTool();
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
    const newTools: IInfoTool[] = [];

    for (const taskData of this.data.tools) {
      let tool: IInfoTool | undefined = undefined;

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

    world.setDynamicProperty("cc_debug:data", stateStr);
  }

  tick() {
    this._sessionTick++;

    if (this._sessionTick % 100 === 0) {
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
