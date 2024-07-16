import ITask from "./ITask";

export default interface IInfoTask extends ITask {
  getInfo(): string;
  getShortInfo(): string;
  getTitle(): string;
}
