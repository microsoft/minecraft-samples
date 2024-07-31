import ITool from "./ITool";

export default interface IInfoTool extends ITool {
  getInfo(): string;
  getShortInfo(): string;
  getTitle(): string;
}
