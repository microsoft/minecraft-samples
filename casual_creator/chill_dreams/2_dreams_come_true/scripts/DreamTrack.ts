import { Block, Vector3, system, world } from "@minecraft/server";
import Dream from "./Dream";
import IDreamReference from "./IDreamReference";
import Utilities from "./Utilities";
import IVectorXZ from "./IVectorXZ";

export default class DreamTrack {
  referencePoint: IDreamReference;
  segments: Vector3[] | undefined = undefined;
  directionX: number = 0;
  directionZ: number = 0;
  #dream: Dream;
  tickLength: number = 400;
  popup: number = 0;
  tickIndex: number = 0;

  lastActiveSegmentIndex: number = -1;

  constructor(dream: Dream, refPoint: IDreamReference) {
    this.referencePoint = refPoint;
    this.#dream = dream;
    this.addTrackMessage = this.addTrackMessage.bind(this);
  }

  generateSegments(retryIndex: number) {
    // pick a general "cardinal direction" - e.g., west, northwest, southeast, etc.;
    let candidateDirectionX = Math.floor(Math.random() * 3) - 1;
    let candidateDirectionZ = Math.floor(Math.random() * 3) - 1;

    let attempts = 0;

    // keep rolling until we've picked a good cardinal direction
    while (candidateDirectionX === 0 && candidateDirectionZ === 0 && attempts < 10) {
      candidateDirectionX = Math.floor(Math.random() * 3) - 1;
      candidateDirectionZ = Math.floor(Math.random() * 3) - 1;

      attempts++;
    }

    // if we're going diagonally, decrease the velocity at which we travel
    if (candidateDirectionX !== 0 && candidateDirectionZ !== 0) {
      candidateDirectionX = candidateDirectionX / 2;
      candidateDirectionZ = candidateDirectionZ / 2;
    }

    this.directionX = candidateDirectionX;
    this.directionZ = candidateDirectionZ;

    // choose our two start and stop points
    const startXZ = {
      x: this.referencePoint.location.x + candidateDirectionX * 20,
      z: this.referencePoint.location.z + candidateDirectionZ * 20,
    };

    const endXZ = {
      x: this.referencePoint.location.x - candidateDirectionX * 20,
      z: this.referencePoint.location.z - candidateDirectionZ * 20,
    };

    const candidatePopup = Math.floor(Math.random() * 10) + 10;

    const retryAdjust = retryIndex * (this.referencePoint.dimensionId === "nether" ? 4 : 10);

    const startY = this.referencePoint.location.y + retryAdjust;

    this.popup = candidatePopup;
    const startPoint = this.getWaypointAt(startXZ, startY, candidatePopup);

    if (startPoint === undefined) {
      // this is probably triggering because the chunk is still loading...
      return;
    }

    const endPoint = this.getWaypointAt(endXZ, startY, candidatePopup);

    if (endPoint === undefined) {
      // Could not find a good endpoint.
      return;
    }

    this.segments = [startPoint, endPoint];

    for (let i = 0; i < Math.floor((this.tickLength - 400) / 400); i++) {
      this.segments.push({
        x: this.referencePoint.location.x - candidateDirectionX * ((i + 2) * 20),
        y: endPoint.y,
        z: this.referencePoint.location.z - candidateDirectionZ * ((i + 2) * 20),
      });
    }

    this.subdivideSegments();
  }

  subdivideSegments() {
    if (this.segments === undefined) {
      return;
    }
    const newSegments: Vector3[] = [];

    for (let i = 0; i < this.segments.length - 1; i++) {
      const deltaX = this.segments[i + 1].x - this.segments[i].x;
      const deltaY = this.segments[i + 1].y - this.segments[i].y;
      const deltaZ = this.segments[i + 1].z - this.segments[i].z;

      newSegments.push(this.segments[i]);
      newSegments.push({
        x: this.segments[i].x + deltaX * 0.25,
        y: this.segments[i].y + deltaY * 0.25,
        z: this.segments[i].z + deltaZ * 0.25,
      });
      newSegments.push({
        x: this.segments[i].x + deltaX * 0.5,
        y: this.segments[i].y + deltaY * 0.5,
        z: this.segments[i].z + deltaZ * 0.5,
      });
      newSegments.push({
        x: this.segments[i].x + deltaX * 0.75,
        y: this.segments[i].y + deltaY * 0.75,
        z: this.segments[i].z + deltaZ * 0.75,
      });
    }

    newSegments.push(this.segments[this.segments.length - 1]);
    this.segments = newSegments;
  }

  getWaypointAt(xz: IVectorXZ, startY: number, popup: number) {
    const groundBlock = this.getGroundBlockFrom({ x: xz.x, y: startY, z: xz.z });

    if (groundBlock === undefined) {
      return undefined;
    }

    const pointAbove = groundBlock.above(popup);

    if (!pointAbove || !pointAbove.permutation.matches("minecraft:air")) {
      return undefined;
    }

    return pointAbove.location;
  }

  getGroundBlockFrom(seedLoc: Vector3): Block | undefined {
    const dimension = world.getDimension(this.referencePoint.dimensionId);

    let seedY = seedLoc.y;

    let curBlock = dimension.getBlock({
      x: seedLoc.x,
      y: seedY,
      z: seedLoc.z,
    });

    while (curBlock !== undefined && curBlock.permutation.matches("minecraft:air") && seedY > -64) {
      seedY--;
      curBlock = dimension.getBlock({
        x: seedLoc.x,
        y: seedY,
        z: seedLoc.z,
      });
    }

    if (curBlock === undefined) {
      return undefined;
    }

    return curBlock;
  }

  // get a "human" description of our direction of travel
  getDirectionStr() {
    let dirStr = "";

    if (this.directionZ < 0) {
      dirStr = "north";
    } else if (this.directionZ > 0) {
      dirStr = "south";
    }

    if (this.directionX < 0) {
      dirStr += "west";
    } else if (this.directionX > 0) {
      dirStr += "east";
    }

    return dirStr;
  }

  getRotationFromXZ() {
    if (this.directionX < 0) {
      if (this.directionZ < 0) {
        return 315;
      } else if (this.directionZ > 0) {
        return 225;
      }

      return 270;
    } else if (this.directionX > 0) {
      if (this.directionZ < 0) {
        return 45;
      } else if (this.directionZ > 0) {
        return 135;
      }

      return 90;
    }

    if (this.directionZ < 0) {
      return 0;
    }

    return 180;
  }

  addTrackMessage() {
    if (!this.segments || this.segments.length < 2) {
      return;
    }

    const player = Utilities.getPlayerById(this.#dream.playerId);

    if (!player) {
      return;
    }

    let title = this.referencePoint.title.toLowerCase().trim();

    if (title.indexOf("random") >= 0) {
      title = "in " + title;
    } else if (title.indexOf("nightmares ")) {
      title = "near " + title;
    }

    let updateStr =
      "Going " +
      this.getDirectionStr() +
      " " +
      title +
      " (" +
      Math.floor(this.segments[0].x) +
      ", " +
      Math.floor(this.segments[0].y) +
      ", " +
      Math.floor(this.segments[0].z) +
      ")";

    if (this.#dream.tracks.length % 4 === 1 || this.#dream.tracks.length < 3) {
      updateStr += " §o(sprint to wake up)§r";
    }

    player.onScreenDisplay.setActionBar(updateStr);
    player.onScreenDisplay.setTitle(" ", {
      fadeInDuration: 20,
      fadeOutDuration: 20,
      stayDuration: 240,
    });
  }

  fixUpSegmentPoint(segmentIndex: number) {
    if (!this.segments) {
      return;
    }

    const segPoint = this.segments[segmentIndex];

    const waypoint = this.getWaypointAt({ x: segPoint.x, z: segPoint.z }, segPoint.y - this.popup, this.popup);

    if (waypoint) {
      this.segments[segmentIndex] = waypoint;
    }
  }

  tick() {
    const player = Utilities.getPlayerById(this.#dream.playerId);

    if (!player) {
      return;
    }

    let generateSegmentAttempts = 0;
    const segmentsAreNewlyDefined = this.segments === undefined;

    while (this.segments === undefined && generateSegmentAttempts < 12) {
      this.generateSegments(generateSegmentAttempts);
      generateSegmentAttempts++;
    }

    if (this.segments === undefined || this.segments.length < 2) {
      player.teleport(
        {
          x: this.referencePoint.location.x,
          y: this.referencePoint.location.y + 10,
          z: this.referencePoint.location.z,
        },
        {
          dimension: world.getDimension(this.referencePoint.dimensionId),
        }
      );
    } else {
      if (segmentsAreNewlyDefined) {
        system.runTimeout(this.addTrackMessage, this.#dream.tracks.length < 2 ? 220 : 60);
      }

      let segmentLength = this.tickLength / (this.segments.length - 1);
      let activeSegmentIndex = Math.floor(this.tickIndex / segmentLength);

      if (activeSegmentIndex >= this.segments.length - 1) {
        return;
      }

      const ticksInSegmentPercent = (this.tickIndex % segmentLength) / segmentLength;

      if (activeSegmentIndex !== this.lastActiveSegmentIndex) {
        this.fixUpSegmentPoint(activeSegmentIndex + 1);
        this.lastActiveSegmentIndex = activeSegmentIndex;
      }

      const thisSegment = this.segments[activeSegmentIndex];
      const nextSegment = this.segments[activeSegmentIndex + 1];

      player.teleport(
        {
          x: thisSegment.x + (nextSegment.x - thisSegment.x) * ticksInSegmentPercent,
          y: thisSegment.y + (nextSegment.y - thisSegment.y) * ticksInSegmentPercent,
          z: thisSegment.z + (nextSegment.z - thisSegment.z) * ticksInSegmentPercent,
        },
        {
          rotation: {
            x: 0,
            y: this.getRotationFromXZ(),
          },
          dimension: world.getDimension(this.referencePoint.dimensionId),
        }
      );
    }

    this.tickIndex++;

    if (this.tickIndex == this.tickLength - 70) {
      player.camera.fade({
        fadeColor: { red: 0, green: 0, blue: 0 },
        fadeTime: {
          fadeInTime: 3,
          fadeOutTime: 3,
          holdTime: 1,
        },
      });
    }
  }
}
