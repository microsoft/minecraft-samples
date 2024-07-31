import { system, world } from "@minecraft/server";
import IDebugToolsData from "./IDebugToolsData";
import TimeOfDayInfoTool from "./tools/TimeOfDayInfoTool";
import IInfoTool from "./IInfoTool";
import TickInfoTool from "./tools/TickInfoTool";
import ScoreboardInfoTool from "./tools/ScoreboardInfoTool";
import LocationInfoTool from "./tools/LocationInfoTool";
import ITaskData from "./IToolData";

export const StaticDisplayTaskIds = ["timeOfDay", "tick"];

export default class DebugTools {
  _sessionTick: number = 0;
  _log: ((message: string) => void) | undefined = undefined;

  notifyDisplayDataUpdatedList: (() => void)[] = [];

  data: IDebugToolsData = {
    tools: [],
    displayInSubHeader: false,
  };

  _displayTasks: IInfoTool[] = [];

  get displayTasks() {
    return this._displayTasks;
  }

  get displayToolData() {
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

  removeToolById(taskId: string) {
    const newArr: ITaskData[] = [];

    for (const task of this.displayToolData) {
      if (task.id !== taskId) {
        newArr.push(task);
      }
    }

    this.data.tools = newArr;

    this.applyToolSetChange();
    this.save();
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

  createToolByTypeId(typeId: string) {
    let task: IInfoTool | undefined = undefined;

    switch (typeId.toLowerCase()) {
      case "timeofday":
        task = new TimeOfDayInfoTool();
      case "tick":
        task = new TickInfoTool();
      case "scoreboard":
        task = new ScoreboardInfoTool();
      case "location":
        task = new LocationInfoTool();
    }

    if (task) {
      task.typeId = typeId.toLowerCase();
      task.data = "";
    }

    return task;
  }

  applyToolSetChange() {
    this._displayTasks = [];

    for (const taskData of this.data.tools) {
      const newTask = this.createToolByTypeId(taskData.typeId);

      if (newTask) {
        this._displayTasks.push(newTask);
      }
    }
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
      for (const task of this._displayTasks) {
        task.run();
      }

      for (const fn of this.notifyDisplayDataUpdatedList) {
        fn();
      }
    }

    system.run(this.tick);
  }
}
