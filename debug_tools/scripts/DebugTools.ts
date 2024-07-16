import { Scoreboard, system, world } from "@minecraft/server";
import IDebugToolsData from "./IDebugToolsData";
import TimeOfDay from "./tasks/TimeOfDay";
import IInfoTask from "./IInfoTask";
import Tick from "./tasks/Tick";
import ScoreboardMeasure from "./tasks/ScoreboardMeasure";

export const AvailableDisplayTaskIds = ["timeOfDay", "tick"];

export default class DebugTools {
  _sessionTick: number = 0;
  _log: ((message: string) => void) | undefined = undefined;

  notifyDisplayDataUpdatedList: (() => void)[] = [];

  data: IDebugToolsData = {
    displayTaskIds: ["timeOfDay"],
    displayInSubHeader: false,
  };

  _displayTasks: IInfoTask[] = [];

  get displayTasks() {
    return this._displayTasks;
  }

  get displayTaskIds() {
    return this.data.displayTaskIds;
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

  removeDisplayTaskId(taskId: string) {
    const newArr: string[] = [];

    for (const str in this.displayTaskIds) {
      if (str !== taskId) {
        newArr.push(str);
      }
    }

    this.data.displayTaskIds = newArr;

    this.applyTaskSetChange();
    this.save();
  }

  addDisplayTaskId(taskId: string) {
    if (!this.data.displayTaskIds.includes(taskId)) {
      this.data.displayTaskIds.push(taskId);

      this.applyTaskSetChange();

      this.save();
    }
  }

  log(message: string) {
    if (this._log) {
      this._log(message);
    }
  }

  init() {
    this.load();
    this.applyTaskSetChange();

    system.run(this.tick);
  }

  createTask(id: string) {
    if (id.startsWith("s|") && id.length > 2) {
      const sbd = new ScoreboardMeasure();
      sbd.data = id.substring(2);
      return sbd;
    }

    switch (id.toLowerCase()) {
      case "timeofday":
        return new TimeOfDay();
      case "tick":
        return new Tick();

      default:
        return undefined;
    }
  }

  applyTaskSetChange() {
    this._displayTasks = [];

    for (const taskId of this.data.displayTaskIds) {
      const newTask = this.createTask(taskId);

      if (newTask) {
        this._displayTasks.push(newTask);
      }
    }
  }

  load() {
    const stateStr = world.getDynamicProperty("ma_debug:data");

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

    world.setDynamicProperty("ma_debug:data", stateStr);
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
