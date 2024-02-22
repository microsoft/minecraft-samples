import { Vector3 } from "@minecraft/server";

export default interface IDreamReference {
  location: Vector3;
  dimensionId: string;
  title: string;
}
