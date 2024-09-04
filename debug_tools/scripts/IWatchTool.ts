import ITool from "./ITool";

export default interface IWatchTool extends ITool {
  getInfo(): string;
  getShortInfo(): string;
  getTitle(): string;
}
