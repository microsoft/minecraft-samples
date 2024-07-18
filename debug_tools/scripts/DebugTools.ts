import { Scoreboard, system, world } from "@minecraft/server";
import IDebugToolsData from "./IDebugToolsData";
import TimeOfDay from "./tasks/TimeOfDay";
import IInfoTask from "./IInfoTask";
import Tick from "./tasks/Tick";
import ScoreboardMeasure from "./tasks/ScoreboardMeasure";
import LocationMeasure from "./tasks/LocationMeasure";
import ITaskData from "./ITaskData";

export const StaticDisplayTaskIds = ["timeOfDay", "tick"];

export default class DebugTools {
  _sessionTick: number = 0;
  _log: ((message: string) => void) | undefined = undefined;

  notifyDisplayDataUpdatedList: (() => void)[] = [];

  data: IDebugToolsData = {
    tasks: [],
    displayInSubHeader: false,
  };

  _displayTasks: IInfoTask[] = [];

  get displayTasks() {
    return this._displayTasks;
  }

  get displayTaskData() {
    return this.data.tasks;
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
    const newArr: ITaskData[] = [];

    for (const task of this.displayTaskData) {
      if (task.id !== taskId) {
        newArr.push(task);
      }
    }

    this.data.tasks = newArr;

    this.applyTaskSetChange();
    this.save();
  }

  addDisplayTaskId(taskId: string) {
    /*    if (!this.data.tasks.includes(taskId)) {
      this.data.tasks.push(taskId);

      this.applyTaskSetChange();

      this.save();
    }*/
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
    let task: IInfoTask | undefined = undefined;

    switch (id.toLowerCase()) {
      case "timeofday":
        task = new TimeOfDay();
      case "tick":
        task = new Tick();
      case "scoreboard":
        task = new ScoreboardMeasure();
      case "location":
        task = new LocationMeasure();
    }

    if (task) {
      task.typeId = id.toLowerCase();
      task.data = "";
    }

    return task;
  }

  applyTaskSetChange() {
    this._displayTasks = [];

    for (const taskData of this.data.tasks) {
      const newTask = this.createTask(taskData.typeId);

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
