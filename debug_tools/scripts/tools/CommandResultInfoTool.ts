import IInfoTool from "../IInfoTool";

export default class CommandResultInfoTool implements IInfoTool {
  id: string = "commandResult";
  typeId: string = "commandResult";
  data: string = "";
  info: string = "";

  run() {
    this.info = "commandResult" + this.id;
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
