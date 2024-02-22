import { Player, Vector3 } from "@minecraft/server";
import IMemory from "./IMemory";
import { ModalFormData, ModalFormResponse } from "@minecraft/server-ui";
import MemorySet from "./MemorySet";

export default class Memory {
  #data: IMemory;
  #memorySet: MemorySet;

  constructor(memorySet: MemorySet, entityId: string) {
    this.#memorySet = memorySet;
    this.#data = { entityId: entityId };

    this.#memorySet.data.memories[entityId] = this.#data;
  }

  get entityId() {
    return this.#data.entityId;
  }

  get title() {
    return this.#data.title;
  }

  set title(newTitleId: string | undefined) {
    this.#data.title = newTitleId;
  }

  get location() {
    return this.#data.location;
  }

  set location(newLoc: Vector3 | undefined) {
    this.#data.location = newLoc;
  }

  get dimensionId() {
    return this.#data.dimensionId;
  }

  set dimensionId(newDim: string | undefined) {
    this.#data.dimensionId = newDim;
  }

  getLocationDescription() {
    if (!this.#data.location) {
      return "Somewhere";
    }

    return (
      "X: " +
      Math.floor(this.#data.location.x) +
      " Y: " +
      Math.floor(this.#data.location.y) +
      " Z: " +
      Math.floor(this.#data.location.z)
    );
  }

  getEffectiveTitle() {
    if (this.#data.title) {
      return this.#data.title;
    }

    return this.getLocationDescription();
  }

  loadFromData(data: IMemory) {
    this.#data = data;
    this.#memorySet.data.memories[this.entityId] = this.#data;
  }

  async showEditor(player: Player) {
    const modalForm = new ModalFormData()
      .title("Edit a memory")
      .textField("Title", this.title ? this.title : "New Memory", this.title);

    let response: ModalFormResponse | undefined = undefined;

    try {
      response = await modalForm.show(player);
    } catch (e) {
      return;
    }

    if (response && response.formValues && response.formValues.length > 0) {
      if (typeof response.formValues[0] === "string") {
        this.title = response.formValues[0];
      }

      this.#memorySet.save();
    }
  }
}
