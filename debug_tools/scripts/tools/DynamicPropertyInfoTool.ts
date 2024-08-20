import IInfoTool from "../IInfoTool";

export default class DynamicPropertyInfoTool implements IInfoTool {
  id: string = "dynamicProperty";
  typeId: string = "dynamicProperty";
  data: string = "";
  info: string = "";

  run() {
    this.info = "dynprop" + this.id;
  }

  getTitle() {
    return this.id;
  }
  getInfo(): string {
    return this.info;
  }

  getShortInfo(): string {
    return this.getInfo();
  }
}
