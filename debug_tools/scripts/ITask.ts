export default interface ITask {
  id: string;
  data: string;
  typeId: string;
  run: () => void;
}
