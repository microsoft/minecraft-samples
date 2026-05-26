import { BlockPermutation, BlockVolume } from "@minecraft/server";
import { ScoutedSite } from "./levelScout";
import { SegmentBuilt, SegmentContext, buildFlatBaseForPuzzle, paletteFor } from "./levelBuilder";

/**
 * Runtime instance of a puzzle attached to a built segment.
 * Lifecycle: build() is called once during segment creation; onTick / onProjectileRest
 * fire during gameplay while the player is in or near the segment.
 */
export interface Puzzle {
  id: string;
  xStart: number;
  xEnd: number;
  /** Called every game tick. */
  onTick?(playerLoc: { x: number; y: number; z: number }, site: ScoutedSite): void;
  /** Called when a tracked projectile rests inside [xStart, xEnd]. */
  onProjectileRest?(itemId: string, loc: { x: number; y: number; z: number }, site: ScoutedSite): void;
}

export interface PuzzleDef {
  id: string;
  /** Build geometry for the puzzle into the segment. Returns standard SegmentBuilt. */
  build(ctx: SegmentContext, instanceId: string): SegmentBuilt;
  /** Construct the runtime instance that handles tick / projectile-rest events. */
  makeInstance(ctx: SegmentContext, instanceId: string): Puzzle;
  weight: number;
}

const REGISTRY: PuzzleDef[] = [];

export function pickPuzzle(): PuzzleDef | undefined {
  if (REGISTRY.length === 0) return undefined;
  const totalWeight = REGISTRY.reduce((a, p) => a + p.weight, 0);
  let r = Math.random() * totalWeight;
  for (const p of REGISTRY) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return REGISTRY[REGISTRY.length - 1];
}

// ────────────────────── Pressure-plate gate (heavy_stone) ──────────────────────
//
// Layout (along X, on the play plane Z), player approaches from the left:
//   ground────[gate│││]────[plate]────ground
// A 3-tall iron-bar gate blocks the path. The wooden pressure plate sits on
// the FAR side of the gate, out of reach. The player must arc a `heavy_stone`
// over the top of the bars so it lands on the plate; the stone is heavy /
// high-friction enough to come to rest there. When the puzzle detects a
// heavy_stone resting on the plate, the gate opens.

const pressurePlateGate: PuzzleDef = {
  id: "pressure_plate_gate",
  weight: 1.0,
  build(ctx, _id): SegmentBuilt {
    buildFlatBaseForPuzzle(ctx);
    const groundY = ctx.entryGroundY;
    const doorX = ctx.xStart + 8;
    const plateX = doorX + 4;

    // Plate.
    const plate = BlockPermutation.resolve("minecraft:wooden_pressure_plate");
    ctx.dimension.setBlockPermutation({ x: plateX, y: groundY + 1, z: ctx.playZ }, plate);

    // 3-tall iron-bar gate.
    const bars = BlockPermutation.resolve("minecraft:iron_bars");
    ctx.dimension.fillBlocks(
      new BlockVolume({ x: doorX, y: groundY + 1, z: ctx.playZ }, { x: doorX, y: groundY + 3, z: ctx.playZ }),
      bars
    );

    // Decorative gate frame above.
    const p = paletteFor(ctx.theme);
    ctx.dimension.setBlockPermutation({ x: doorX, y: groundY + 4, z: ctx.playZ }, p.wall);

    return { xStart: ctx.xStart, xEnd: ctx.xEnd, exitGroundY: groundY };
  },
  makeInstance(ctx, id): Puzzle {
    const groundY = ctx.entryGroundY;
    const doorX = ctx.xStart + 8;
    const plateX = doorX + 4;
    const playZ = ctx.playZ;
    let opened = false;

    const openGate = () => {
      if (opened) return;
      opened = true;
      try {
        const air = BlockPermutation.resolve("minecraft:air");
        ctx.dimension.fillBlocks(
          new BlockVolume({ x: doorX, y: groundY + 1, z: playZ }, { x: doorX, y: groundY + 3, z: playZ }),
          air
        );
        ctx.dimension.runCommand(`playsound block.iron_door.open @a ${doorX} ${groundY + 2} ${playZ}`);
      } catch {
        /* ignore */
      }
    };

    const heavyStoneOnPlate = (): boolean => {
      // Scan for a heavy_stone entity in a small box centred on the plate.
      try {
        const entities = ctx.dimension.getEntities({
          location: { x: plateX + 0.5, y: groundY + 1.5, z: playZ + 0.5 },
          maxDistance: 1.6,
          type: "toss_lab:heavy_stone",
        });
        return entities.length > 0;
      } catch {
        return false;
      }
    };

    return {
      id,
      xStart: ctx.xStart,
      xEnd: ctx.xEnd,
      onTick() {
        // Poll: pressure plate visibly depresses as soon as the stone lands,
        // but a stone sitting on a plate often keeps micro-bouncing and never
        // satisfies the "at rest" velocity threshold. Detect presence directly.
        if (opened) return;
        if (heavyStoneOnPlate()) openGate();
      },
      onProjectileRest(itemId, loc) {
        // Fallback path in case the entity comes fully to rest exactly on the plate.
        if (opened) return;
        if (itemId !== "toss_lab:heavy_stone") return;
        if (Math.abs(loc.x - plateX) > 1.2) return;
        if (Math.abs(loc.y - (groundY + 1)) > 1.5) return;
        openGate();
      },
    };
  },
};

// ────────────────────── Ice slide bridge (ice_disc) ──────────────────────
//
// Layout: a wide gap (8 blocks) the player can't normally clear. Throwing an
// ice_disc into the gap converts to packed_ice blocks forming a slick bridge.

const iceSlideBridge: PuzzleDef = {
  id: "ice_slide_bridge",
  weight: 0.8,
  build(ctx, _id): SegmentBuilt {
    const groundY = ctx.entryGroundY;
    const p = paletteFor(ctx.theme);
    // Solid platforms at both ends.
    ctx.dimension.fillBlocks(
      new BlockVolume({ x: ctx.xStart, y: groundY - 2, z: ctx.playZ }, { x: ctx.xStart + 6, y: groundY, z: ctx.playZ }),
      p.ground
    );
    ctx.dimension.fillBlocks(
      new BlockVolume({ x: ctx.xEnd - 6, y: groundY - 2, z: ctx.playZ }, { x: ctx.xEnd, y: groundY, z: ctx.playZ }),
      p.ground
    );
    ctx.dimension.setBlockPermutation({ x: ctx.xStart, y: groundY, z: ctx.playZ }, p.surface);
    // Carve the gap.
    const air = BlockPermutation.resolve("minecraft:air");
    ctx.dimension.fillBlocks(
      new BlockVolume(
        { x: ctx.xStart + 7, y: groundY - 4, z: ctx.playZ },
        { x: ctx.xEnd - 7, y: groundY + 18, z: ctx.playZ }
      ),
      air
    );
    return { xStart: ctx.xStart, xEnd: ctx.xEnd, exitGroundY: groundY };
  },
  makeInstance(ctx, id): Puzzle {
    const groundY = ctx.entryGroundY;
    const playZ = ctx.playZ;
    return {
      id,
      xStart: ctx.xStart,
      xEnd: ctx.xEnd,
      onProjectileRest(itemId, loc) {
        if (itemId !== "toss_lab:ice_disc") return;
        if (loc.y > groundY + 1 || loc.y < groundY - 5) return;
        // Lay 3 packed_ice blocks at the projectile's resting X, on the gap floor.
        try {
          const ice = BlockPermutation.resolve("minecraft:packed_ice");
          const cx = Math.round(loc.x);
          ctx.dimension.fillBlocks(
            new BlockVolume({ x: cx - 1, y: groundY, z: playZ }, { x: cx + 1, y: groundY, z: playZ }),
            ice
          );
        } catch {
          /* ignore */
        }
      },
    };
  },
};

REGISTRY.push(pressurePlateGate, iceSlideBridge);
