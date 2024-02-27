import { Vector3 } from "@minecraft/server";

export default interface IPlayerSettings {
  location: Vector3;
  dimensionId: string;
  gameMode: string;
}
