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
  /** Called the moment a heavy projectile impacts a block inside [xStart, xEnd]. */
  onProjectileImpact?(itemId: string, loc: { x: number; y: number; z: number }, site: ScoutedSite): void;
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

// ────────────────────── Shared helpers ──────────────────────

/** Currently-active puzzle hint, written by whichever puzzle the player is
 *  near and read by the game loop so it can be appended to the aim actionbar
 *  text. Single string so multiple puzzles can't fight over the actionbar
 *  (the player can only be near one puzzle at a time in practice). */
let _activeHint: string | undefined;

/** Called by the game's actionbar update; returns the current hint (or undefined). */
export function getActiveHint(): string | undefined {
  return _activeHint;
}

interface HintState {
  /** Set true once the hint is published, so we know to clear it when out of range. */
  published: boolean;
}

/** Publish a hint to the game's actionbar while the player is near an
 *  unsolved puzzle; clear it when the player leaves or the puzzle is solved. */
function showHint(
  _ctx: SegmentContext,
  state: HintState,
  message: string,
  nearX: number,
  playerX: number,
  solved: boolean,
  range = 12
): void {
  const inRange = !solved && Math.abs(playerX - nearX) <= range;
  if (inRange) {
    _activeHint = message;
    state.published = true;
  } else if (state.published) {
    // We were publishing a hint; the player has moved away or solved it.
    // Only clear if _we_ were the active writer.
    if (_activeHint === message) _activeHint = undefined;
    state.published = false;
  }
}

/** Build a color-coded "this is a puzzle" marker at the entry of a puzzle
 *  segment so the player can tell puzzle terrain from plain jump-across terrain
 *  at a glance, plus an optional note sign describing the puzzle.
 *
 *  Both pieces are kept OUT of the 1-wide lane the player walks through:
 *    - the colored marker floats above head height (it used to be a 3-tall
 *      solid column at lane height — a "pre-wall" the player had to climb over
 *      before they could even attempt the puzzle), and
 *    - the note sign has no collision and mounts on a hidden support behind the
 *      lane, so the player can read it and still walk straight through.
 *  - `color`: the BlockPermutation for the marker cap (typically wool).
 *  - `body`: optional marker material (defaults to glowstone). Use a material
 *    that suggests the required projectile (slime, packed_ice, stone, etc.)
 *    to make the puzzle's intent unmissable.
 *  - `label`: optional sign text naming the required projectile. */
function buildPuzzleBeacon(
  ctx: SegmentContext,
  color: BlockPermutation,
  body?: BlockPermutation,
  label?: string
): void {
  const groundY = ctx.entryGroundY;
  const bx = ctx.xStart + 1; // just inside the puzzle on the player's approach side
  const z = ctx.playZ;
  try {
    const beaconBody = body ?? BlockPermutation.resolve("minecraft:glowstone");
    // Floating marker above head height — flags the puzzle from a distance and
    // hints at the projectile, without blocking the lane.
    ctx.dimension.setBlockPermutation({ x: bx, y: groundY + 5, z }, beaconBody);
    ctx.dimension.setBlockPermutation({ x: bx, y: groundY + 6, z }, beaconBody);
    ctx.dimension.setBlockPermutation({ x: bx, y: groundY + 7, z }, color);

    if (label) {
      // Note sign at eye level, facing the camera (+Z, south). It mounts on a
      // hidden barrier support behind the lane (z - 1, where the back barrier
      // sits) and signs have no collision, so the lane stays completely clear.
      // facing_direction:3 = south = text visible from +Z (camera side).
      ctx.dimension.setBlockPermutation(
        { x: bx, y: groundY + 2, z: z - 1 },
        BlockPermutation.resolve("minecraft:barrier")
      );
      const sign = BlockPermutation.resolve("minecraft:oak_wall_sign", { facing_direction: 3 });
      const signPos = { x: bx, y: groundY + 2, z };
      ctx.dimension.setBlockPermutation(signPos, sign);
      try {
        const block = ctx.dimension.getBlock(signPos);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const signComp = block?.getComponent("minecraft:sign") as any;
        if (signComp?.setText) signComp.setText(label);
      } catch {
        /* ignore — sign without text is still a visual cue */
      }
    }
  } catch {
    /* ignore */
  }
}

/** Returns true if any toss_lab projectile entity is within `radius` of point. */
function projectileNear(
  ctx: SegmentContext,
  point: { x: number; y: number; z: number },
  radius: number,
  itemId?: string
): boolean {
  try {
    const nearby = ctx.dimension.getEntities({ location: point, maxDistance: radius });
    for (const e of nearby) {
      if (!e.typeId.startsWith("toss_lab:")) continue;
      if (itemId && e.typeId !== itemId) continue;
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
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
    buildPuzzleBeacon(
      ctx,
      BlockPermutation.resolve("minecraft:orange_wool"),
      BlockPermutation.resolve("minecraft:cobblestone"),
      "§6Heavy Stone\n§7→ plate"
    );
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
    const hint: HintState = { published: false };

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
      onTick(playerLoc) {
        showHint(ctx, hint, "\u00a76Toss a Heavy Stone onto the pressure plate!", doorX - 4, playerLoc.x, opened);
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

// ──────────────────── Ice slide bridge (ice_disc) ──────────────────────
//
// A 10-block gap the player can't jump. The player must skim an ice_disc
// across the gap so it slides onto the far platform (ice_disc has friction
// 0.05 so it slides far). Every air column the disc flies over is recorded;
// if the disc successfully reaches the far platform, those exact columns
// freeze into packed_ice — the disc literally lays down its own path. A
// disc that falls into the pit leaves nothing behind, so the player must
// throw another.

const iceSlideBridge: PuzzleDef = {
  id: "ice_slide_bridge",
  weight: 0.8,
  build(ctx, _id): SegmentBuilt {
    buildPuzzleBeacon(
      ctx,
      BlockPermutation.resolve("minecraft:light_blue_wool"),
      BlockPermutation.resolve("minecraft:packed_ice"),
      "§bIce Disc\n§7→ skim across"
    );
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
    // Visible "landing pad" of light-blue wool on the far platform so the
    // player knows where to aim the disc.
    const target = BlockPermutation.resolve("minecraft:light_blue_wool");
    ctx.dimension.setBlockPermutation({ x: ctx.xEnd - 6, y: groundY, z: ctx.playZ }, target);
    ctx.dimension.setBlockPermutation({ x: ctx.xEnd - 5, y: groundY, z: ctx.playZ }, target);
    return { xStart: ctx.xStart, xEnd: ctx.xEnd, exitGroundY: groundY };
  },
  makeInstance(ctx, id): Puzzle {
    const groundY = ctx.entryGroundY;
    const playZ = ctx.playZ;
    const leftEdge = ctx.xStart + 6;
    const rightEdge = ctx.xEnd - 6;
    const farLandingMinX = rightEdge - 1; // disc must reach at least the far platform
    const hint: HintState = { published: false };
    let bridged = false;

    // Track the path of every ice_disc currently in flight over this gap.
    // Each entry is the set of integer x positions the disc flew over above
    // the gap floor — when (and ONLY when) a disc successfully reaches the
    // far platform, those exact x positions are converted to packed_ice.
    // A disc that falls into the pit leaves no ice behind.
    const tracks = new Map<string, Set<number>>();

    const freezeTrack = (xs: Set<number>) => {
      const ice = BlockPermutation.resolve("minecraft:packed_ice");
      let count = 0;
      for (const xi of xs) {
        if (xi < leftEdge + 1 || xi > rightEdge - 1) continue;
        try {
          ctx.dimension.setBlockPermutation({ x: xi, y: groundY, z: playZ }, ice);
          count++;
        } catch {
          /* ignore */
        }
      }
      if (count > 0) {
        try {
          ctx.dimension.runCommand(`playsound block.glass.break @a ${(leftEdge + rightEdge) / 2} ${groundY} ${playZ}`);
        } catch {
          /* ignore */
        }
      }
      return count;
    };

    return {
      id,
      xStart: ctx.xStart,
      xEnd: ctx.xEnd,
      onTick(playerLoc) {
        showHint(
          ctx,
          hint,
          "\u00a7bSkim an Ice Disc across the gap \u2014 every air block it flies over freezes!",
          ctx.xStart + 4,
          playerLoc.x,
          bridged
        );

        // Phase 1: update flight tracks. For every ice_disc currently above
        // the gap, record the integer x-column it's flying over so we can
        // freeze that exact path if it makes it across.
        let discs;
        try {
          discs = ctx.dimension.getEntities({ type: "toss_lab:ice_disc" });
        } catch {
          return;
        }

        const seenIds = new Set<string>();
        for (const d of discs) {
          let loc;
          try {
            loc = d.location;
          } catch {
            continue;
          }
          if (Math.abs(loc.z - playZ) > 2.5) continue;

          // Out of this puzzle's x-extent entirely.
          if (loc.x < ctx.xStart - 2 || loc.x > ctx.xEnd + 4) continue;
          seenIds.add(d.id);

          // Record the column if the disc is currently above the gap floor
          // and within the gap's x-extent. y must be above the pit floor
          // (groundY - 4) — if it's already lower it's lost.
          const xi = Math.floor(loc.x);
          const overGap = xi >= leftEdge + 1 && xi <= rightEdge - 1;
          const aboveFloor = loc.y > groundY - 0.5;
          if (overGap && aboveFloor) {
            let track = tracks.get(d.id);
            if (!track) {
              track = new Set<number>();
              tracks.set(d.id, track);
            }
            track.add(xi);
            // Tiny ice particle puff while flying — shows the trail forming.
            try {
              ctx.dimension.runCommand(`particle minecraft:basic_crit_particle ${loc.x} ${loc.y + 0.2} ${loc.z}`);
            } catch {
              /* ignore */
            }
          }

          // Success: disc has reached the far platform alive.
          if (!bridged && loc.y >= groundY - 0.2 && loc.x >= farLandingMinX) {
            const track = tracks.get(d.id);
            if (track && track.size > 0) {
              const placed = freezeTrack(track);
              // If the path covered most of the gap, mark the puzzle solved
              // so the hint clears. Otherwise keep playing \u2014 partial paths
              // still leave their ice and the player can throw more discs.
              const gapWidth = rightEdge - 1 - (leftEdge + 1) + 1;
              if (placed >= gapWidth - 1) bridged = true;
            }
            tracks.delete(d.id);
            try {
              d.remove();
            } catch {
              /* ignore */
            }
          } else if (loc.y < groundY - 3) {
            // Disc fell into the pit \u2014 no ice for you.
            tracks.delete(d.id);
          }
        }

        // Garbage-collect tracks for discs that no longer exist (despawned,
        // expired, or were converted back to items by the projectile manager).
        for (const id of tracks.keys()) {
          if (!seenIds.has(id)) tracks.delete(id);
        }
      },
      onProjectileRest(_itemId, _loc) {
        // Intentionally a no-op: per-tick path-tracking above is the source
        // of truth. A disc resting at the bottom of the pit must NOT trigger
        // a bridge \u2014 only one that actually flew across does.
      },
    };
  },
};

// ────────────────────── Bell ring (rubber_sphere is the easy mode) ──────────────────────
//
// A 4-block-tall wall blocks the path with a bell mounted on top. Hitting the
// bell with ANY projectile opens the wall. Rubber spheres are easiest because
// they bounce; cotton puffs work too thanks to their floaty arc.

const bellRing: PuzzleDef = {
  id: "bell_ring",
  weight: 1.0,
  build(ctx, _id): SegmentBuilt {
    buildFlatBaseForPuzzle(ctx);
    buildPuzzleBeacon(
      ctx,
      BlockPermutation.resolve("minecraft:yellow_wool"),
      BlockPermutation.resolve("minecraft:gold_block"),
      "§eRing the Bell\n§7any throw"
    );
    const groundY = ctx.entryGroundY;
    const wallX = ctx.xStart + 10;
    const p = paletteFor(ctx.theme);

    // Tall wall.
    ctx.dimension.fillBlocks(
      new BlockVolume({ x: wallX, y: groundY + 1, z: ctx.playZ }, { x: wallX, y: groundY + 4, z: ctx.playZ }),
      p.wall
    );
    // Gold pillar above the wall to support the bell — also serves as the
    // distinctive "this is a puzzle" visual cue.
    const gold = BlockPermutation.resolve("minecraft:gold_block");
    ctx.dimension.setBlockPermutation({ x: wallX, y: groundY + 5, z: ctx.playZ }, gold);
    try {
      ctx.dimension.setBlockPermutation(
        { x: wallX, y: groundY + 6, z: ctx.playZ },
        BlockPermutation.resolve("minecraft:bell")
      );
    } catch {
      // If bell can't be placed (state issue), leave the gold pillar visible.
    }
    return { xStart: ctx.xStart, xEnd: ctx.xEnd, exitGroundY: groundY };
  },
  makeInstance(ctx, id): Puzzle {
    const groundY = ctx.entryGroundY;
    const wallX = ctx.xStart + 10;
    const playZ = ctx.playZ;
    let opened = false;
    const hint: HintState = { published: false };

    const openWall = () => {
      if (opened) return;
      opened = true;
      try {
        const air = BlockPermutation.resolve("minecraft:air");
        ctx.dimension.fillBlocks(
          new BlockVolume({ x: wallX, y: groundY + 1, z: playZ }, { x: wallX, y: groundY + 4, z: playZ }),
          air
        );
        ctx.dimension.runCommand(`playsound block.bell.hit @a ${wallX} ${groundY + 6} ${playZ}`);
      } catch {
        /* ignore */
      }
    };

    return {
      id,
      xStart: ctx.xStart,
      xEnd: ctx.xEnd,
      onTick(playerLoc) {
        showHint(ctx, hint, "\u00a76Ring the bell to open the wall!", wallX - 5, playerLoc.x, opened);
        if (opened) return;
        // Any toss_lab projectile near the bell triggers the wall to open.
        if (
          projectileNear(ctx, { x: wallX + 0.5, y: groundY + 6.5, z: playZ + 0.5 }, 2.0) ||
          projectileNear(ctx, { x: wallX + 0.5, y: groundY + 5.5, z: playZ + 0.5 }, 2.0)
        ) {
          openWall();
        }
      },
    };
  },
};

// ────────────────────── Cotton Bridge (cotton_puff) ──────────────────────
//
// Wide 12-block gap. Throwing cotton_puffs into the gap stamps white_wool
// blocks where they rest, letting the player build their own bridge.
// Cotton puff's floaty arc + light force makes it the right tool — heavier
// projectiles overshoot and fall in.

const cottonBridge: PuzzleDef = {
  id: "cotton_bridge",
  weight: 0.9,
  build(ctx, _id): SegmentBuilt {
    buildPuzzleBeacon(
      ctx,
      BlockPermutation.resolve("minecraft:white_wool"),
      BlockPermutation.resolve("minecraft:white_wool"),
      "§fCotton Puff\n§7→ fill the gap"
    );
    const groundY = ctx.entryGroundY;
    const p = paletteFor(ctx.theme);
    const leftEdge = ctx.xStart + 5;
    const rightEdge = ctx.xEnd - 5;

    // Solid platforms at each side.
    ctx.dimension.fillBlocks(
      new BlockVolume({ x: ctx.xStart, y: groundY - 2, z: ctx.playZ }, { x: leftEdge, y: groundY, z: ctx.playZ }),
      p.ground
    );
    ctx.dimension.fillBlocks(
      new BlockVolume({ x: rightEdge, y: groundY - 2, z: ctx.playZ }, { x: ctx.xEnd, y: groundY, z: ctx.playZ }),
      p.ground
    );
    // Carve the gap above and below ground level so projectiles fall away cleanly.
    const air = BlockPermutation.resolve("minecraft:air");
    ctx.dimension.fillBlocks(
      new BlockVolume(
        { x: leftEdge + 1, y: groundY - 6, z: ctx.playZ },
        { x: rightEdge - 1, y: groundY + 18, z: ctx.playZ }
      ),
      air
    );
    // White wool caps on the inner edges — visual cue: "cotton puzzle".
    const wool = BlockPermutation.resolve("minecraft:white_wool");
    ctx.dimension.setBlockPermutation({ x: leftEdge, y: groundY, z: ctx.playZ }, wool);
    ctx.dimension.setBlockPermutation({ x: rightEdge, y: groundY, z: ctx.playZ }, wool);
    return { xStart: ctx.xStart, xEnd: ctx.xEnd, exitGroundY: groundY };
  },
  makeInstance(ctx, id): Puzzle {
    const leftEdge = ctx.xStart + 5;
    const hint: HintState = { published: false };
    return {
      id,
      xStart: ctx.xStart,
      xEnd: ctx.xEnd,
      onTick(playerLoc) {
        showHint(
          ctx,
          hint,
          "\u00a7fString Cotton Puffs from the edge to bridge the gap!",
          leftEdge - 3,
          playerLoc.x,
          false
        );
      },
    };
  },
};

// ────────────────────── Sticky Climb (sticky_glob) ──────────────────────
//
// 5-block-tall wall the player can't jump. Each sticky_glob the player lands
// in front of the wall consumes the glob and places the next slime block of
// a 3-step staircase. After 3 globs the player can hop up the staircase and
// over the wall.

const stickyClimb: PuzzleDef = {
  id: "sticky_climb",
  weight: 0.9,
  build(ctx, _id): SegmentBuilt {
    buildFlatBaseForPuzzle(ctx);
    buildPuzzleBeacon(
      ctx,
      BlockPermutation.resolve("minecraft:lime_wool"),
      BlockPermutation.resolve("minecraft:slime"),
      "§aSticky Glob\n§7→ build steps"
    );
    const groundY = ctx.entryGroundY;
    const p = paletteFor(ctx.theme);
    const wallX = ctx.xStart + 12;

    // Bridge any gap from the previous segment so globs (and the player) don't
    // fall through. The puzzle's flat base only covers [xStart, xEnd]; if the
    // segment before us was a tplGap/tplFloating, there'd be air on our left.
    ctx.dimension.fillBlocks(
      new BlockVolume(
        { x: ctx.xStart - 3, y: groundY - 2, z: ctx.playZ },
        { x: ctx.xStart - 1, y: groundY, z: ctx.playZ }
      ),
      p.ground
    );
    ctx.dimension.setBlockPermutation({ x: ctx.xStart - 3, y: groundY, z: ctx.playZ }, p.surface);
    ctx.dimension.setBlockPermutation({ x: ctx.xStart - 2, y: groundY, z: ctx.playZ }, p.surface);
    ctx.dimension.setBlockPermutation({ x: ctx.xStart - 1, y: groundY, z: ctx.playZ }, p.surface);

    // 3-block-tall wall — unjumpable (Jump Boost II clears 2), but only needs
    // 2 slime steps to clear with a final jump.
    ctx.dimension.fillBlocks(
      new BlockVolume({ x: wallX, y: groundY + 1, z: ctx.playZ }, { x: wallX, y: groundY + 3, z: ctx.playZ }),
      p.wall
    );
    // Ghost outlines of where the slime steps will appear, made of lime
    // stained-glass. Visible through, but shows the player exactly where to
    // build. Each glob thrown into the puzzle replaces one with a real slime
    // block.
    const ghost = BlockPermutation.resolve("minecraft:lime_stained_glass");
    ctx.dimension.setBlockPermutation({ x: wallX - 2, y: groundY + 1, z: ctx.playZ }, ghost);
    ctx.dimension.setBlockPermutation({ x: wallX - 1, y: groundY + 2, z: ctx.playZ }, ghost);
    // Lime wool floor markers on the approach side — visual cue: "sticky puzzle".
    const lime = BlockPermutation.resolve("minecraft:lime_wool");
    ctx.dimension.setBlockPermutation({ x: wallX - 4, y: groundY, z: ctx.playZ }, lime);
    ctx.dimension.setBlockPermutation({ x: wallX - 3, y: groundY, z: ctx.playZ }, lime);
    return { xStart: ctx.xStart, xEnd: ctx.xEnd, exitGroundY: groundY };
  },
  makeInstance(ctx, id): Puzzle {
    const groundY = ctx.entryGroundY;
    const playZ = ctx.playZ;
    const wallX = ctx.xStart + 12;
    const hint: HintState = { published: false };

    // Staircase plan: each accepted glob places the next step, replacing the
    // matching ghost-glass marker. After 2 steps, the player can hop up
    // (slime+2 = wall top) and over the 3-block wall.
    const steps: { x: number; y: number }[] = [
      { x: wallX - 2, y: groundY + 1 },
      { x: wallX - 1, y: groundY + 2 },
    ];
    let nextStep = 0;

    const placeNextStep = () => {
      if (nextStep >= steps.length) return;
      const step = steps[nextStep++];
      try {
        const slime = BlockPermutation.resolve("minecraft:slime");
        ctx.dimension.setBlockPermutation({ x: step.x, y: step.y, z: playZ }, slime);
        ctx.dimension.runCommand(`playsound mob.slime.big @a ${step.x} ${step.y} ${playZ}`);
      } catch {
        /* ignore */
      }
    };

    return {
      id,
      xStart: ctx.xStart,
      xEnd: ctx.xEnd,
      onTick(playerLoc) {
        const stepsLeft = steps.length - nextStep;
        const msg =
          stepsLeft > 0
            ? `§aToss Sticky Globs near the wall — ${stepsLeft} step${stepsLeft === 1 ? "" : "s"} to go!`
            : "";
        showHint(ctx, hint, msg, wallX - 5, playerLoc.x, nextStep >= steps.length);
        if (nextStep >= steps.length) return;
        // Don't rely on rest detection — sticky_glob's high friction makes it
        // micro-twitch and never satisfy the "at rest" velocity threshold.
        // Scan ALL sticky globs in the dimension and pick any inside this
        // puzzle's approach zone. (Sphere queries can miss entities mid-flight
        // or that just entered the radius; an x-range filter is bulletproof.)
        try {
          const globs = ctx.dimension.getEntities({ type: "toss_lab:sticky_glob" });
          for (const g of globs) {
            if (nextStep >= steps.length) break;
            const gLoc = g.location;
            if (Math.abs(gLoc.z - playZ) > 3) continue;
            // Approach zone: from a few blocks before the wall up to the wall
            // itself. Anything that lands here counts. We deliberately don't
            // reject overshoots — if a glob flew past, that's a misthrow but
            // we'd rather still count it than have nothing happen.
            if (gLoc.x < wallX - 8) continue;
            if (gLoc.x > wallX + 2) continue;
            // Visible burst at the glob's location so the player sees that
            // detection fired.
            try {
              ctx.dimension.runCommand(`particle minecraft:large_explosion ${gLoc.x} ${gLoc.y + 0.3} ${gLoc.z}`);
            } catch {
              /* ignore */
            }
            placeNextStep();
            try {
              g.remove();
            } catch {
              /* ignore */
            }
          }
        } catch {
          /* ignore */
        }
      },
    };
  },
};

// ────────────────────── TNT Blast (heavy_stone) ──────────────────────
//
// Wall blocks the path with a TNT block embedded in front. A heavy_stone
// resting against the TNT "detonates" — clearing the wall, sound + particles.
// Lighter projectiles bounce off harmlessly.

const tntBlast: PuzzleDef = {
  id: "tnt_blast",
  weight: 0.8,
  build(ctx, _id): SegmentBuilt {
    buildFlatBaseForPuzzle(ctx);
    buildPuzzleBeacon(
      ctx,
      BlockPermutation.resolve("minecraft:red_wool"),
      BlockPermutation.resolve("minecraft:tnt"),
      "§cHeavy Stone\n§7→ blast TNT"
    );
    const groundY = ctx.entryGroundY;
    const p = paletteFor(ctx.theme);
    const wallX = ctx.xStart + 12;

    // 4-block-tall wall.
    ctx.dimension.fillBlocks(
      new BlockVolume({ x: wallX, y: groundY + 1, z: ctx.playZ }, { x: wallX, y: groundY + 4, z: ctx.playZ }),
      p.wall
    );
    // TNT in front of the wall at ground level.
    const tnt = BlockPermutation.resolve("minecraft:tnt");
    ctx.dimension.setBlockPermutation({ x: wallX - 1, y: groundY + 1, z: ctx.playZ }, tnt);
    // Red wool flanking markers — visual cue: "heavy stone puzzle".
    const red = BlockPermutation.resolve("minecraft:red_wool");
    ctx.dimension.setBlockPermutation({ x: wallX - 2, y: groundY, z: ctx.playZ }, red);
    ctx.dimension.setBlockPermutation({ x: wallX - 3, y: groundY, z: ctx.playZ }, red);
    return { xStart: ctx.xStart, xEnd: ctx.xEnd, exitGroundY: groundY };
  },
  makeInstance(ctx, id): Puzzle {
    const groundY = ctx.entryGroundY;
    const playZ = ctx.playZ;
    const wallX = ctx.xStart + 12;
    const tntX = wallX - 1;
    let exploded = false;
    const hint: HintState = { published: false };

    const detonate = () => {
      if (exploded) return;
      exploded = true;
      try {
        const air = BlockPermutation.resolve("minecraft:air");
        ctx.dimension.fillBlocks(
          new BlockVolume({ x: tntX, y: groundY + 1, z: playZ }, { x: wallX, y: groundY + 4, z: playZ }),
          air
        );
        ctx.dimension.runCommand(`playsound random.explode @a ${wallX} ${groundY + 2} ${playZ}`);
        ctx.dimension.spawnParticle("minecraft:huge_explosion_emitter", {
          x: wallX + 0.5,
          y: groundY + 2.5,
          z: playZ + 0.5,
        });
      } catch {
        /* ignore */
      }
    };

    return {
      id,
      xStart: ctx.xStart,
      xEnd: ctx.xEnd,
      onTick(playerLoc) {
        showHint(ctx, hint, "\u00a7cBlast the TNT with a Heavy Stone!", wallX - 6, playerLoc.x, exploded);
      },
      onProjectileImpact(itemId, loc) {
        if (exploded) return;
        if (itemId !== "toss_lab:heavy_stone") return;
        if (Math.abs(loc.x - tntX) > 1.5) return;
        if (Math.abs(loc.y - (groundY + 1)) > 2) return;
        detonate();
      },
      onProjectileRest(itemId, loc) {
        if (exploded) return;
        if (itemId !== "toss_lab:heavy_stone") return;
        if (Math.abs(loc.x - tntX) > 1.5) return;
        if (Math.abs(loc.y - (groundY + 1)) > 2) return;
        detonate();
      },
    };
  },
};

REGISTRY.push(pressurePlateGate, iceSlideBridge, bellRing, cottonBridge, stickyClimb, tntBlast);
