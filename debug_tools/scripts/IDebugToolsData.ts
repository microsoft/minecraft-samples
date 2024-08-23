import ITaskData from "./IToolData";

export default interface IDebugToolsData {
  tools: ITaskData[];
  displayInSubHeader: boolean;
  displayConsoleWarning: boolean;
  displayIngameMessage: boolean;
  displayScoreboard: boolean;
}
