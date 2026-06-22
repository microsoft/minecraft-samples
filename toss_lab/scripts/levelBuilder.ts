import { BlockPermutation, BlockVolume, Dimension } from "@minecraft/server";
import { SEGMENT_WIDTH, PUZZLE_INTERVAL_MIN, PUZZLE_INTERVAL_MAX } from "./config";
import { ScoutedSite, SiteTheme } from "./levelScout";
import { Puzzle, pickPuzzle } from "./puzzles";

/** Result of building a single segment, used by the game to extend barriers/corridor. */
export interface SegmentBuilt {
  xStart: number;
  xEnd: number;
  /** Ground Y at the right edge — next segment must enter at this height. */
  exitGroundY: number;
}

interface SegmentContext {
  dimension: Dimension;
  playZ: number;
  xStart: number;
  xEnd: number;
  /** Ground Y on entry (left edge). */
  entryGroundY: number;
  theme: SiteTheme;
  segmentIndex: number;
}

type SegmentTemplate = (ctx: SegmentContext) => SegmentBuilt;

/**
 * Streaming, segment-based level generator. Produces SEGMENT_WIDTH-wide chunks
 * of toss lab geometry on demand as the player moves right.
 */
export class LevelBuilder {
  private nextSegmentX: number;
  private currentGroundY: number;
  private segmentsBuilt = 0;
  private nextPuzzleAt: number;
  /** Puzzles indexed by id; each puzzle owns the X range it occupies. */
  private puzzles = new Map<string, Puzzle>();
  /** Recorded ground profile per built segment, so the game can anchor its
   *  corridor clearing / barriers to the actual lane height even where the
   *  level has descended — scanning the play plane there is unreliable because
   *  natural terrain can sit above a descended lane. Pruned from the front so
   *  it stays bounded over long runs. */
  private groundProfile: { xStart: number; xEnd: number; entryY: number; exitY: number }[] = [];

  constructor(public readonly site: ScoutedSite) {
    this.nextSegmentX = site.originX;
    this.currentGroundY = site.groundY;
    this.nextPuzzleAt = randInt(PUZZLE_INTERVAL_MIN, PUZZLE_INTERVAL_MAX);
  }

  /** Build the next segment immediately, regardless of player position. */
  buildOneSegment(): SegmentBuilt {
    const xStart = this.nextSegmentX;
    const xEnd = xStart + SEGMENT_WIDTH - 1;
    const ctx: SegmentContext = {
      dimension: this.site.dimension,
      playZ: this.site.playZ,
      xStart,
      xEnd,
      entryGroundY: this.currentGroundY,
      theme: this.site.theme,
      segmentIndex: this.segmentsBuilt,
    };

    let result: SegmentBuilt;
    let isPuzzle = false;
    if (this.segmentsBuilt >= this.nextPuzzleAt) {
      const puzzle = pickPuzzle();
      if (puzzle) {
        const id = `puzzle_${this.segmentsBuilt}_${xStart}`;
        result = puzzle.build(ctx, id);
        this.puzzles.set(id, puzzle.makeInstance(ctx, id));
        isPuzzle = true;
        this.nextPuzzleAt = this.segmentsBuilt + randInt(PUZZLE_INTERVAL_MIN, PUZZLE_INTERVAL_MAX);
      } else {
        result = pickAndBuildTerrain(ctx);
      }
    } else {
      result = pickAndBuildTerrain(ctx);
    }

    // Clamp the running ground height so the level can't drift beyond the
    // play ticking area's vertical bounds (±40 below / +60 above the site).
    const baseY = this.site.groundY;
    const clampedExit = Math.min(baseY + 30, Math.max(baseY - 20, result.exitGroundY));
    this.currentGroundY = clampedExit;
    this.nextSegmentX = result.xEnd + 1;
    this.segmentsBuilt++;
    void isPuzzle;

    // Record the lane-height profile for this segment (entry → exit), pruning
    // the oldest entries so the list stays bounded on long runs.
    this.groundProfile.push({ xStart: ctx.xStart, xEnd: result.xEnd, entryY: ctx.entryGroundY, exitY: clampedExit });
    if (this.groundProfile.length > 512) this.groundProfile.shift();

    return { ...result, exitGroundY: clampedExit };
  }

  /**
   * Build segments until at least `lookahead` blocks are present beyond `playerX`,
   * AND keep filling all the way out to `safeMaxX` (typically the right edge of
   * currently loaded chunks minus a margin). This second condition matters when
   * the player is temporarily stopped (e.g. against the safety wall) but loaded
   * chunks are available ahead — we still want to keep generating so the wall
   * can move forward.
   */
  ensureBuiltAhead(playerX: number, lookahead: number, safeMaxX: number = Infinity): SegmentBuilt[] {
    const built: SegmentBuilt[] = [];
    const target = Math.max(playerX + lookahead, safeMaxX);
    while (this.nextSegmentX <= target) {
      // Don't build into chunks that aren't loaded yet.
      if (this.nextSegmentX + SEGMENT_WIDTH - 1 > safeMaxX) break;
      built.push(this.buildOneSegment());
    }
    return built;
  }

  /** X of the rightmost block already generated. */
  get frontierMaxX(): number {
    return this.nextSegmentX - 1;
  }

  /** Approximate the built lane surface height at column `x` from the recorded
   *  segment profile (entry → exit, interpolated across the segment). Used by
   *  the game to anchor corridor clearing and barriers to the real ground even
   *  on descended sections, where scanning the play plane is fooled by natural
   *  terrain sitting above the lane. Falls back to the current ground height
   *  for columns outside the recorded profile. */
  groundYAt(x: number): number {
    for (let i = this.groundProfile.length - 1; i >= 0; i--) {
      const s = this.groundProfile[i];
      if (x >= s.xStart && x <= s.xEnd) {
        const span = Math.max(1, s.xEnd - s.xStart);
        const t = Math.min(1, Math.max(0, (x - s.xStart) / span));
        return Math.round(s.entryY + (s.exitY - s.entryY) * t);
      }
    }
    return this.currentGroundY;
  }

  get totalSegments(): number {
    return this.segmentsBuilt;
  }

  // ── Puzzle plumbing ─────────────────────────────────────────────────────

  tickPuzzles(playerLoc: { x: number; y: number; z: number }): void {
    for (const p of this.puzzles.values()) {
      try {
        p.onTick?.(playerLoc, this.site);
      } catch {
        /* swallow puzzle bugs */
      }
    }
  }

  /** Called by the game when a tracked projectile comes to rest. */
  onProjectileRest(itemId: string, loc: { x: number; y: number; z: number }): void {
    for (const p of this.puzzles.values()) {
      if (loc.x >= p.xStart && loc.x <= p.xEnd) {
        try {
          p.onProjectileRest?.(itemId, loc, this.site);
        } catch {
          /* swallow */
        }
      }
    }
  }

  /** Called by the game when a heavy projectile impacts/detonates a block. */
  onProjectileImpact(itemId: string, loc: { x: number; y: number; z: number }): void {
    for (const p of this.puzzles.values()) {
      if (loc.x >= p.xStart && loc.x <= p.xEnd) {
        try {
          p.onProjectileImpact?.(itemId, loc, this.site);
        } catch {
          /* swallow */
        }
      }
    }
  }
}

// ────────────────────────── Terrain Templates ──────────────────────────

function pickAndBuildTerrain(ctx: SegmentContext): SegmentBuilt {
  // Difficulty ramp: more interesting templates as segmentIndex grows.
  const easy: SegmentTemplate[] = [tplFlat, tplFlat, tplStairUp, tplStairDown];
  const medium: SegmentTemplate[] = [tplFlat, tplGap, tplWall, tplFloating, tplStairUp];
  const hard: SegmentTemplate[] = [tplGap, tplFloating, tplWall, tplPillarField, tplStairDown];

  let pool: SegmentTemplate[];
  if (ctx.segmentIndex < 5) pool = easy;
  else if (ctx.segmentIndex < 20) pool = medium;
  else pool = hard;

  const tpl = pool[Math.floor(Math.random() * pool.length)];
  return tpl(ctx);
}

function palette(theme: SiteTheme) {
  if (theme === "cave") {
    return {
      ground: BlockPermutation.resolve("minecraft:deepslate"),
      surface: BlockPermutation.resolve("minecraft:deepslate"),
      platform: BlockPermutation.resolve("minecraft:cobbled_deepslate"),
      wall: BlockPermutation.resolve("minecraft:deepslate_bricks"),
    };
  }
  return {
    ground: BlockPermutation.resolve("minecraft:stone"),
    surface: BlockPermutation.resolve("minecraft:grass_block"),
    platform: BlockPermutation.resolve("minecraft:oak_planks"),
    wall: BlockPermutation.resolve("minecraft:cobblestone"),
  };
}

function fillGround(ctx: SegmentContext, xStart: number, xEnd: number, groundY: number): void {
  const p = palette(ctx.theme);
  ctx.dimension.fillBlocks(
    new BlockVolume({ x: xStart, y: groundY - 2, z: ctx.playZ }, { x: xEnd, y: groundY - 1, z: ctx.playZ }),
    p.ground
  );
  ctx.dimension.fillBlocks(
    new BlockVolume({ x: xStart, y: groundY, z: ctx.playZ }, { x: xEnd, y: groundY, z: ctx.playZ }),
    p.surface
  );
}

function clearAbove(ctx: SegmentContext, xStart: number, xEnd: number, groundY: number, height = 18): void {
  const air = BlockPermutation.resolve("minecraft:air");
  ctx.dimension.fillBlocks(
    new BlockVolume({ x: xStart, y: groundY + 1, z: ctx.playZ }, { x: xEnd, y: groundY + height, z: ctx.playZ }),
    air
  );
}

const tplFlat: SegmentTemplate = (ctx) => {
  fillGround(ctx, ctx.xStart, ctx.xEnd, ctx.entryGroundY);
  clearAbove(ctx, ctx.xStart, ctx.xEnd, ctx.entryGroundY);
  return { xStart: ctx.xStart, xEnd: ctx.xEnd, exitGroundY: ctx.entryGroundY };
};

const tplGap: SegmentTemplate = (ctx) => {
  // Solid edges, an air pit in the middle.
  const groundY = ctx.entryGroundY;
  const gapStart = ctx.xStart + 5 + Math.floor(Math.random() * 4);
  const gapEnd = gapStart + 2 + Math.floor(Math.random() * 3);
  fillGround(ctx, ctx.xStart, gapStart - 1, groundY);
  fillGround(ctx, gapEnd + 1, ctx.xEnd, groundY);
  clearAbove(ctx, ctx.xStart, ctx.xEnd, groundY);
  // Carve the pit too in case natural blocks were there.
  const air = BlockPermutation.resolve("minecraft:air");
  ctx.dimension.fillBlocks(
    new BlockVolume({ x: gapStart, y: groundY - 4, z: ctx.playZ }, { x: gapEnd, y: groundY, z: ctx.playZ }),
    air
  );
  return { xStart: ctx.xStart, xEnd: ctx.xEnd, exitGroundY: groundY };
};

const tplStairUp: SegmentTemplate = (ctx) => {
  // Cap the level so it stays inside the play ticking area's Y bounds.
  const maxY = ctx.entryGroundY + 8;
  const desired = ctx.entryGroundY + 2 + Math.floor(Math.random() * 2);
  const exit = Math.min(desired, maxY);
  buildRamp(ctx, ctx.entryGroundY, exit);
  return { xStart: ctx.xStart, xEnd: ctx.xEnd, exitGroundY: exit };
};

const tplStairDown: SegmentTemplate = (ctx) => {
  const minY = ctx.entryGroundY - 8;
  const desired = ctx.entryGroundY - 2 - Math.floor(Math.random() * 2);
  const exit = Math.max(desired, minY);
  buildRamp(ctx, ctx.entryGroundY, exit);
  return { xStart: ctx.xStart, xEnd: ctx.xEnd, exitGroundY: exit };
};

function buildRamp(ctx: SegmentContext, fromY: number, toY: number): void {
  const len = ctx.xEnd - ctx.xStart + 1;
  const dy = toY - fromY;
  for (let i = 0; i < len; i++) {
    const t = (i + 1) / len;
    const y = Math.round(fromY + dy * t);
    const x = ctx.xStart + i;
    fillGround(ctx, x, x, y);
    clearAbove(ctx, x, x, y);
  }
}

const tplWall: SegmentTemplate = (ctx) => {
  fillGround(ctx, ctx.xStart, ctx.xEnd, ctx.entryGroundY);
  clearAbove(ctx, ctx.xStart, ctx.xEnd, ctx.entryGroundY);
  const p = palette(ctx.theme);
  const wallX = ctx.xStart + 8 + Math.floor(Math.random() * 6);
  // 2 blocks tall: clearable with the player's Jump Boost II. A 3-tall wall
  // would be unjumpable and dead-end the run.
  const h = 2;
  ctx.dimension.fillBlocks(
    new BlockVolume(
      { x: wallX, y: ctx.entryGroundY + 1, z: ctx.playZ },
      { x: wallX, y: ctx.entryGroundY + h, z: ctx.playZ }
    ),
    p.wall
  );
  return { xStart: ctx.xStart, xEnd: ctx.xEnd, exitGroundY: ctx.entryGroundY };
};

const tplFloating: SegmentTemplate = (ctx) => {
  // Gap with floating platforms over it. Spacing/height tuned so each hop is
  // a comfortable single-block jump (3 blocks horizontal, 1 block up).
  const groundY = ctx.entryGroundY;
  fillGround(ctx, ctx.xStart, ctx.xStart + 3, groundY);
  fillGround(ctx, ctx.xEnd - 3, ctx.xEnd, groundY);
  clearAbove(ctx, ctx.xStart, ctx.xEnd, groundY);
  const air = BlockPermutation.resolve("minecraft:air");
  ctx.dimension.fillBlocks(
    new BlockVolume({ x: ctx.xStart + 4, y: groundY - 4, z: ctx.playZ }, { x: ctx.xEnd - 4, y: groundY, z: ctx.playZ }),
    air
  );
  const p = palette(ctx.theme);
  // Three 3-wide stepping platforms, each one block above ground level.
  // Edge xStart+3 → P1 xStart+6  (3 blocks)
  // P1 ends xStart+8 → P2 xStart+11 (3 blocks)
  // P2 ends xStart+13 → P3 xStart+16 (3 blocks)
  // P3 ends xStart+18 → exit xStart+20 (2 blocks)
  const platformY = groundY + 2;
  const xs = [ctx.xStart + 6, ctx.xStart + 11, ctx.xStart + 16];
  for (const px of xs) {
    ctx.dimension.fillBlocks(
      new BlockVolume({ x: px, y: platformY, z: ctx.playZ }, { x: px + 2, y: platformY, z: ctx.playZ }),
      p.platform
    );
  }
  return { xStart: ctx.xStart, xEnd: ctx.xEnd, exitGroundY: groundY };
};

const tplPillarField: SegmentTemplate = (ctx) => {
  fillGround(ctx, ctx.xStart, ctx.xEnd, ctx.entryGroundY);
  clearAbove(ctx, ctx.xStart, ctx.xEnd, ctx.entryGroundY);
  const p = palette(ctx.theme);
  for (let x = ctx.xStart + 4; x < ctx.xEnd - 2; x += 4) {
    // 1 or 2 blocks tall — both clearable with Jump Boost II.
    const h = 1 + Math.floor(Math.random() * 2);
    ctx.dimension.fillBlocks(
      new BlockVolume({ x, y: ctx.entryGroundY + 1, z: ctx.playZ }, { x, y: ctx.entryGroundY + h, z: ctx.playZ }),
      p.wall
    );
  }
  return { xStart: ctx.xStart, xEnd: ctx.xEnd, exitGroundY: ctx.entryGroundY };
};

// ────────────────────────── Helpers exposed to puzzles ────────────────────

export function buildFlatBaseForPuzzle(ctx: SegmentContext): void {
  fillGround(ctx, ctx.xStart, ctx.xEnd, ctx.entryGroundY);
  clearAbove(ctx, ctx.xStart, ctx.xEnd, ctx.entryGroundY);
}

export function paletteFor(theme: SiteTheme): ReturnType<typeof palette> {
  return palette(theme);
}

export type { SegmentContext };

function randInt(lo: number, hi: number): number {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}
