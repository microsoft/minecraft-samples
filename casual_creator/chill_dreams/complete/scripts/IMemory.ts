import { Vector3 } from "@minecraft/server";

export default interface IMemory {
  entityId: string;
  location?: Vector3;
  dimensionId?: string;
  title?: string;
}
