export default interface ITool {
  id: string;
  data: string;
  typeId: string;
  run: () => void;
}
