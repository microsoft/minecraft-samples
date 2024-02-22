import { Player, Vector3, world } from "@minecraft/server";
import MemorySet from "./MemorySet";
import IDreamReference from "./IDreamReference";
import DreamTrack from "./DreamTrack";
import Utilities from "./Utilities";

export default class Dream {
  #referencePoints: IDreamReference[] = [];
  #playerId: string;
  tracks: DreamTrack[] = [];
  #trackCount = 0;
  #activeTrack: DreamTrack | undefined = undefined;

  clearDreamCallback: ((player: Player) => void) | undefined = undefined;

  get playerId() {
    return this.#playerId;
  }

  constructor(playerId: string) {
    this.#playerId = playerId;
  }

  setupDreamFromMemories(memorySet: MemorySet) {
    if (memorySet) {
      const memories = memorySet.getMemories();

      for (const memory of memories) {
        if (memory.location && memory.dimensionId)
          this.addPoint(memory.location, memory.dimensionId, memory.getEffectiveTitle());
      }
    }
  }

  addPoint(location: Vector3, dimensionId: string, title: string) {
    if (this.isNearOtherReferencePoint(location, dimensionId)) {
      return;
    }

    this.#referencePoints.push({
      location: location,
      dimensionId: dimensionId,
      title: title,
    });
  }

  isNearOtherReferencePoint(point: Vector3, dimensionId: string) {
    for (const refPoint of this.#referencePoints) {
      if (
        refPoint.dimensionId === dimensionId &&
        Math.abs(refPoint.location.x - point.x) +
          Math.abs(refPoint.location.y - point.y) +
          Math.abs(refPoint.location.z - point.z) <
          200
      ) {
        return true;
      }
    }

    return false;
  }

  preserveSettings() {
    const player = Utilities.getPlayerById(this.#playerId);

    if (!player) {
      return;
    }

    world.setDynamicProperty(
      player.id + "predream",
      JSON.stringify({
        location: player.location,
        dimensionId: player.dimension.id,
      })
    );
  }

  tick() {
    if (this.#activeTrack === undefined) {
      this.generateNextDreamPart();
    }

    if (this.#activeTrack) {
      this.#activeTrack.tick();
    }

    this.#trackCount++;
    const player = Utilities.getPlayerById(this.#playerId);

    if (player) {
      if (player.isSprinting) {
        this.#activeTrack = undefined;

        player.camera.fade({
          fadeColor: { red: 0, green: 0, blue: 0 },
          fadeTime: {
            fadeInTime: 0,
            fadeOutTime: 2,
            holdTime: 0,
          },
        });

        if (this.clearDreamCallback) {
          this.clearDreamCallback(player);
        }
      }
    }

    if (this.#trackCount > (this.#activeTrack ? this.#activeTrack.tickLength : 400)) {
      this.#activeTrack = undefined;
    }
  }

  activate() {
    const player = Utilities.getPlayerById(this.#playerId);

    if (!player) {
      return;
    }

    this.preserveSettings();

    player.runCommand("gamemode spectator @s");

    player.runCommand("inputpermission set @s camera disabled");
  }

  generateAdditionalNearReferencePoints() {
    const newReferencePoints: IDreamReference[] = [];

    for (let i = 0; i < this.#referencePoints.length; i++) {
      const refPoint = this.#referencePoints[i];
      newReferencePoints.push(refPoint);

      for (let j = 0; j < 4; j++) {
        const newVec = {
          x: refPoint.location.x + Math.random() * 800 - 400,
          y: refPoint.location.y + Math.random() * 40 - 20,
          z: refPoint.location.z + Math.random() * 800 - 400,
        };

        if (!this.isNearOtherReferencePoint(newVec, refPoint.dimensionId)) {
          newReferencePoints.push({
            location: newVec,
            dimensionId: refPoint.dimensionId,
            title:
              "Around" +
              (refPoint.title ? " " + refPoint.title : "") +
              " at " +
              refPoint.location.x +
              ", " +
              refPoint.location.z,
          });
        }
      }
    }

    this.#referencePoints = newReferencePoints;
  }

  generateAdditionalRandomPoints() {
    const newReferencePoints: IDreamReference[] = [];

    for (let j = 0; j < Math.min(10, this.#referencePoints.length); j++) {
      const newVec = {
        x: Math.random() * 800 - 400,
        y: Math.random() * 100 - 20,
        z: Math.random() * 800 - 400,
      };

      if (!this.isNearOtherReferencePoint(newVec, "minecraft:overworld")) {
        newReferencePoints.push({
          location: newVec,
          dimensionId: "minecraft:overworld",
          title: "Random places",
        });
      }
    }

    this.#referencePoints = newReferencePoints;
  }

  generateAdditionalNetherPoints() {
    const newReferencePoints: IDreamReference[] = [];

    for (let j = 0; j < Math.min(10, this.#referencePoints.length); j++) {
      const newVec = {
        x: Math.random() * 800 - 400,
        y: Math.random() * 40,
        z: Math.random() * 800 - 400,
      };

      if (!this.isNearOtherReferencePoint(newVec, "nether")) {
        newReferencePoints.push({
          location: newVec,
          dimensionId: "nether",
          title: "Nightmare",
        });
      }
    }

    this.#referencePoints = newReferencePoints;
  }

  generateNextDreamPart() {
    const nextIndex = Math.floor(Math.random() * this.#referencePoints.length);
    const nextRef = this.#referencePoints[nextIndex];

    const dreamPart = new DreamTrack(this, nextRef);

    this.#trackCount = 0;
    dreamPart.tickLength = Math.floor(Math.random() * 2000) + 400;

    this.tracks.push(dreamPart);

    this.#activeTrack = dreamPart;
  }
}
