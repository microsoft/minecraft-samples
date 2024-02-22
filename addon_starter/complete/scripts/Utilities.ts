import { world, BlockPermutation } from "@minecraft/server";

export default class Utilities {
  static fillBlock(
    blockPerm: BlockPermutation,
    xFrom: number,
    yFrom: number,
    zFrom: number,
    xTo: number,
    yTo: number,
    zTo: number
  ) {
    const overworld = world.getDimension("overworld");

    for (let i = xFrom; i <= xTo; i++) {
      for (let j = yFrom; j <= yTo; j++) {
        for (let k = zFrom; k <= zTo; k++) {
          overworld.getBlock({ x: i, y: j, z: k })?.setPermutation(blockPerm);
        }
      }
    }
  }

  static fourWalls(
    perm: BlockPermutation,
    xFrom: number,
    yFrom: number,
    zFrom: number,
    xTo: number,
    yTo: number,
    zTo: number
  ) {
    const overworld = world.getDimension("overworld");

    const xFromP = Math.min(xFrom, xTo);
    const xToP = Math.max(xFrom, xTo);
    const yFromP = Math.min(yFrom, yTo);
    const yToP = Math.max(yFrom, yTo);
    const zFromP = Math.min(zFrom, zTo);
    const zToP = Math.max(zFrom, zTo);

    for (let i = xFromP; i <= xToP; i++) {
      for (let k = yFromP; k <= yToP; k++) {
        overworld.getBlock({ x: i, y: k, z: zFromP })?.setPermutation(perm);
        overworld.getBlock({ x: i, y: k, z: zToP })?.setPermutation(perm);
      }
    }

    for (let j = zFromP + 1; j < zToP; j++) {
      for (let k = yFromP; k <= yToP; k++) {
        overworld.getBlock({ x: xFromP, y: k, z: j })?.setPermutation(perm);
        overworld.getBlock({ x: xToP, y: k, z: j })?.setPermutation(perm);
      }
    }
  }
}
