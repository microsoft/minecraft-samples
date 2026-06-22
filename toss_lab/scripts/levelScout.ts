import { Dimension, Player, system, world } from "@minecraft/server";
import {
  SCOUT_COUNT,
  SCOUT_RADIUS_MIN,
  SCOUT_RADIUS_MAX,
  SCOUT_PROBE_HALF,
  SCOUT_PARALLELISM,
  SCOUT_SAMPLE_STEP,
  FALL_DEPTH,
} from "./config";

export type SiteTheme = "surface" | "cave";

export interface ScoutedSite {
  /** World X where the player should start. */
  originX: number;
  /** Z plane the toss lab will play on. */
  playZ: number;
  /** Ground baseline Y for level geometry. */
  groundY: number;
  /** Scenic theme that won the scoring contest. */
  theme: SiteTheme;
  /** Combined score (for diagnostics / logging). */
  score: number;
  dimension: Dimension;
}

interface Candidate {
  cx: number;
  cz: number;
}

/**
 * Pick candidate sites in a ring around the player, probe
 * them with short-lived ticking areas, score each, and return the winner.
 *
 * All probe ticking areas are torn down before the function returns; the
 * caller is responsible for creating a long-lived play area at the winner's
 * coordinates.
 */
export async function scoutBestSite(player: Player): Promise<ScoutedSite> {
  const dimension = player.dimension;
  const px = Math.floor(player.location.x);
  const pz = Math.floor(player.location.z);

  const candidates: Candidate[] = [];
  for (let i = 0; i < SCOUT_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = SCOUT_RADIUS_MIN + Math.random() * (SCOUT_RADIUS_MAX - SCOUT_RADIUS_MIN);
    candidates.push({
      cx: px + Math.round(Math.cos(angle) * radius),
      cz: pz + Math.round(Math.sin(angle) * radius),
    });
  }

  const results: ScoutedSite[] = [];
  let nextIdx = 0;

  async function worker(workerId: number): Promise<void> {
    while (true) {
      const i = nextIdx++;
      if (i >= candidates.length) return;
      const c = candidates[i];
      const areaId = `tossLab_probe_${workerId}_${i}_${Date.now()}`;
      try {
        const site = await probeAndScore(dimension, c, areaId);
        results.push(site);
      } catch (e) {
        // Probe failed (e.g., area outside world bounds); skip silently.
      } finally {
        try {
          const mgr = world.tickingAreaManager;
          if (mgr.hasTickingArea(areaId)) mgr.removeTickingArea(areaId);
        } catch {
          /* ignore */
        }
      }
    }
  }

  const workers: Promise<void>[] = [];
  for (let w = 0; w < Math.min(SCOUT_PARALLELISM, candidates.length); w++) {
    workers.push(worker(w));
  }
  await Promise.all(workers);

  if (results.length === 0) {
    throw new Error("Scouting produced no usable sites; world may be too small.");
  }

  results.sort((a, b) => b.score - a.score);
  const winner = results[0];
  return winner;
}

async function probeAndScore(dimension: Dimension, c: Candidate, areaId: string): Promise<ScoutedSite> {
  const mgr = world.tickingAreaManager;
  await mgr.createTickingArea(areaId, {
    dimension,
    from: { x: c.cx - SCOUT_PROBE_HALF, y: -64, z: c.cz - SCOUT_PROBE_HALF },
    to: { x: c.cx + SCOUT_PROBE_HALF, y: 320, z: c.cz + SCOUT_PROBE_HALF },
  });
  await waitForAreaLoaded(areaId, 5000);
  return scoreSite(dimension, c);
}

/**
 * Poll TickingArea.isFullyLoaded until the area reports fully loaded
 * or the timeout elapses. `createTickingArea`'s promise only signals that the
 * area was registered, not that all its chunks finished loading.
 */
export async function waitForAreaLoaded(id: string, timeoutMs = 10000): Promise<boolean> {
  const mgr = world.tickingAreaManager;
  const startTick = system.currentTick;
  const maxTicks = Math.ceil(timeoutMs / 50);
  while (true) {
    const area = mgr.getTickingArea(id);
    if (area?.isFullyLoaded) return true;
    if (system.currentTick - startTick > maxTicks) return false;
    await new Promise<void>((resolve) => {
      system.runTimeout(() => resolve(), 2);
    });
  }
}

function scoreSite(dimension: Dimension, c: Candidate): ScoutedSite {
  const playZ = c.cz;
  const surfaceYs: number[] = [];
  let waterCount = 0;
  let backdropMaxY = -Infinity;
  let caveAirCount = 0;

  // Scan a slice of columns along the prospective level X axis, on the playZ line.
  for (let dx = -SCOUT_PROBE_HALF; dx <= SCOUT_PROBE_HALF; dx += SCOUT_SAMPLE_STEP) {
    const x = c.cx + dx;
    const top = safeGetTopY(dimension, x, playZ);
    if (top === undefined) continue;
    surfaceYs.push(top);
    // Water detected when the topmost block itself is water OR the block just
    // above the surface is water (i.e. the surface is the seabed).
    if (isWaterAt(dimension, x, top, playZ) || isWaterAt(dimension, x, top + 1, playZ)) {
      waterCount++;
    }

    // Cave score: count air pockets in a 30-block slab below the surface.
    for (let y = top - 1; y >= top - 30; y--) {
      const b = safeGetBlockId(dimension, x, y, playZ);
      if (b === "minecraft:air" || b === "minecraft:cave_air") caveAirCount++;
    }
  }

  // Backdrop: scan behind the play plane for tall terrain.
  for (let dz = 4; dz <= 12; dz += 2) {
    for (let dx = -SCOUT_PROBE_HALF; dx <= SCOUT_PROBE_HALF; dx += SCOUT_SAMPLE_STEP * 2) {
      const top = safeGetTopY(dimension, c.cx + dx, playZ - dz);
      if (top !== undefined && top > backdropMaxY) backdropMaxY = top;
    }
  }

  if (surfaceYs.length === 0) {
    throw new Error("no surface samples");
  }

  // Hard reject: too much of the play line is underwater.
  const waterFraction = waterCount / surfaceYs.length;
  if (waterFraction > 0.25) {
    throw new Error(`too wet (${(waterFraction * 100).toFixed(0)}% water)`);
  }

  const meanY = surfaceYs.reduce((a, b) => a + b, 0) / surfaceYs.length;
  const variance = surfaceYs.reduce((acc, y) => acc + (y - meanY) * (y - meanY), 0) / surfaceYs.length;
  const relief = Math.sqrt(variance);
  const medianY = [...surfaceYs].sort((a, b) => a - b)[Math.floor(surfaceYs.length / 2)];
  const backdropBonus = Math.max(0, backdropMaxY - medianY);
  const waterPenalty = waterCount * 8;

  const surfaceScore = relief * 4 + backdropBonus * 1.5 - waterPenalty;
  const caveScore = caveAirCount * 0.15 - waterPenalty;

  // Sea level is 63 in the Overworld; require surface theme to sit above it.
  const SEA_LEVEL = 63;
  let theme: SiteTheme;
  let score: number;
  let groundY: number;
  if (caveScore > surfaceScore && caveAirCount > 50) {
    theme = "cave";
    score = caveScore;
    // Place the playing plane down in the cave layer.
    groundY = Math.max(-50, medianY - 20);
  } else {
    theme = "surface";
    score = surfaceScore;
    groundY = Math.max(SEA_LEVEL + 1, medianY);
    // Reject if even after clamping the median is still below sea level by a lot.
    if (medianY < SEA_LEVEL - 2) {
      throw new Error(`surface site too low (medianY=${medianY})`);
    }
  }

  return {
    originX: c.cx - SCOUT_PROBE_HALF + 4,
    playZ,
    groundY,
    theme,
    score,
    dimension,
  };
}

function safeGetTopY(dimension: Dimension, x: number, z: number): number | undefined {
  try {
    const block = dimension.getTopmostBlock({ x, z });
    return block?.location.y;
  } catch {
    return undefined;
  }
}

function safeGetBlockId(dimension: Dimension, x: number, y: number, z: number): string | undefined {
  try {
    const b = dimension.getBlock({ x, y, z });
    return b?.typeId;
  } catch {
    return undefined;
  }
}

function isWaterAt(dimension: Dimension, x: number, y: number, z: number): boolean {
  const id = safeGetBlockId(dimension, x, y, z);
  return id === "minecraft:water" || id === "minecraft:flowing_water";
}

/** Compute the death Y for a chosen site. */
export function deathYFor(site: ScoutedSite): number {
  return site.groundY - FALL_DEPTH;
}
