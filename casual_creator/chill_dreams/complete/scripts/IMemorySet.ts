import IMemory from "./IMemory";

export default interface IMemorySet {
  memories: { [entityId: string]: IMemory | undefined };
}
