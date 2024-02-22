import { Vector3, world } from "@minecraft/server";
import IMemorySet from "./IMemorySet";
import IMemory from "./IMemory";
import Memory from "./Memory";

export default class MemorySet {
  #data: IMemorySet = { memories: {} };
  #isLoaded = false;

  #memories: { [entityId: string]: Memory | undefined } = {};

  constructor() {}

  get data(): IMemorySet {
    return this.#data;
  }

  getMemories() {
    this._ensureLoaded();

    const memoryList: Memory[] = [];

    for (const entityId in this.#memories) {
      const memory = this.#memories[entityId];

      if (memory) {
        memoryList.push(memory);
      }
    }

    return memoryList;
  }

  getMemoryNear(location: Vector3, dimensionId: string) {
    for (const entityId in this.#memories) {
      const memory = this.#memories[entityId];

      if (memory && memory.location && memory.dimensionId === dimensionId) {
        if (
          Math.abs(memory.location.x - location.x) +
            Math.abs(memory.location.y - location.y) +
            Math.abs(memory.location.z - location.z) <
          10
        ) {
          return memory;
        }
      }
    }

    return undefined;
  }

  removeMemoryOnly(memory: Memory) {
    this._ensureLoaded();

    // remove the wrapper object and the underlying data object.
    this.#memories[memory.entityId] = undefined;
    this.#data.memories[memory.entityId] = undefined;

    this.save();
  }

  load() {
    const data = world.getDynamicProperty("mamm_cds:memories");

    this.#isLoaded = true;

    if (!data || typeof data !== "string") {
      return;
    }

    let memorySetDataObj: IMemorySet | undefined = undefined;

    try {
      memorySetDataObj = JSON.parse(data) as IMemorySet;
    } catch (e) {
      return;
    }

    // do some data validation and re-build our memory set with only 'proper' items
    const newDataObj: IMemorySet = { memories: {} };

    for (const entityId in memorySetDataObj.memories) {
      const memoryDataObj = memorySetDataObj.memories[entityId];

      if (memoryDataObj) {
        if (memoryDataObj.entityId && memoryDataObj.location) {
          const memory = this.ensureMemory(entityId);

          memory.loadFromData(memoryDataObj);

          newDataObj.memories[entityId] = memoryDataObj;
        }
      }
    }

    this.#data = newDataObj;
  }

  save() {
    // if we haven't loaded, then no data was modified, so this should be a no-op.
    if (!this.#isLoaded) {
      return;
    }

    const dataStr = JSON.stringify(this.#data);

    world.setDynamicProperty("mamm_cds:memories", dataStr);
  }

  private _ensureLoaded() {
    if (!this.#isLoaded) {
      this.load();
    }
  }

  getMemory(entityId: string): Memory | undefined {
    this._ensureLoaded();

    return this.#memories[entityId];
  }

  ensureMemory(entityId: string): Memory {
    this._ensureLoaded();

    let memory = this.#memories[entityId];

    if (memory === undefined) {
      memory = new Memory(this, entityId);
      this.#memories[entityId] = memory;
    }

    return memory;
  }
}
