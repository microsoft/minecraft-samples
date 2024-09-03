import { Vector3 } from "@minecraft/server";

export default class Utilities {
  static getLocationFromString(data: string, defaultLocation?: Vector3): Vector3 {
    let curX = defaultLocation ? Math.floor(defaultLocation.x) : 0;
    let curY = defaultLocation ? Math.floor(defaultLocation.y) : 0;
    let curZ = defaultLocation ? Math.floor(defaultLocation.z) : 0;

    if (data.length > 0) {
      const splits = data.split(",");

      if (splits.length > 2) {
        try {
          let val = parseInt(splits[0]);
          if (!isNaN(val)) {
            curX = val;
          }
          val = parseInt(splits[1]);
          if (!isNaN(val)) {
            curY = val;
          }
          val = parseInt(splits[2]);
          if (!isNaN(val)) {
            curZ = val;
          }
        } catch (e) {}
      }
    }

    return { x: curX, y: curY, z: curZ };
  }

  static getLocationFromCoordStrings(x: string, y: string, z: string, defaultLocation?: Vector3) {
    let curX = defaultLocation ? defaultLocation.x : 0;
    let curY = defaultLocation ? defaultLocation.y : 0;
    let curZ = defaultLocation ? defaultLocation.z : 0;

    try {
      let val = parseInt(x);
      if (!isNaN(val)) {
        curX = val;
      }
      val = parseInt(y);
      if (!isNaN(val)) {
        curY = val;
      }
      val = parseInt(z);
      if (!isNaN(val)) {
        curZ = val;
      }
    } catch (e) {}
    return { x: curX, y: curY, z: curZ };
  }
}
