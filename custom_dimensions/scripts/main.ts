import {
  world,
  system,
  Player,
  Entity,
  BlockPermutation,
  BlockVolume,
  CustomCommandStatus,
  CommandPermissionLevel,
  Dimension,
  Vector3,
  StartupEvent,
  CustomCommandOrigin,
} from "@minecraft/server";

import { ActionFormData } from "@minecraft/server-ui";

// Formatting codes make the menu labels and status messages easier to scan in game.
const Color = {
  red: "\xA7c",
  aqua: "\xA7b",
  green: "\xA7a",
  darkRed: "\xA74",
  purple: "\xA75",
  yellow: "\xA7e",
  gray: "\xA77",
  darkGray: "\xA78",
  bold: "\xA7l",
  reset: "\xA7r",
};

// These IDs are the custom destinations this pack creates.
const VOID_ARENA_ID = "custom_dim:void_arena";
const SKY_LOUNGE_ID = "custom_dim:sky_lounge";
const ENDLESS_RUNNER_ID = "custom_dim:endless_runner";

// Register custom dimensions during startup, before the world begins normal play.
system.beforeEvents.startup.subscribe((event: StartupEvent) => {
  event.dimensionRegistry.registerCustomDimension(VOID_ARENA_ID);
  event.dimensionRegistry.registerCustomDimension(SKY_LOUNGE_ID);
  event.dimensionRegistry.registerCustomDimension(ENDLESS_RUNNER_ID);

  event.customCommandRegistry.registerCommand(
    {
      name: "custom_dim:dimensions",
      description: "Open the dimension travel menu",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
    },
    (origin: CustomCommandOrigin) => {
      const player = origin.sourceEntity;
      if (!player || !(player instanceof Player)) {
        return {
          status: CustomCommandStatus.Failure,
          message: "This command can only be used by a player.",
        };
      }

      system.run(() => showDimensionMenu(player));
      return { status: CustomCommandStatus.Success };
    }
  );
});

interface Platform {
  dimensionId: string;
  blockId: string;
  radius: number;
  center: { x: number; y: number; z: number };
  decor?: boolean;
  rails?: boolean;
}

// Store the build settings for each scripted destination in one place.
const PLATFORMS: Platform[] = [
  {
    dimensionId: VOID_ARENA_ID,
    blockId: "minecraft:crimson_nylium",
    radius: 8,
    center: { x: 0, y: 64, z: 0 },
  },
  {
    dimensionId: SKY_LOUNGE_ID,
    blockId: "minecraft:quartz_block",
    radius: 6,
    center: { x: 0, y: 100, z: 0 },
    decor: true,
  },
  {
    dimensionId: ENDLESS_RUNNER_ID,
    blockId: "minecraft:deepslate_bricks",
    radius: 3,
    center: { x: 0, y: 64, z: 0 },
    rails: false,
  },
];

// Track which custom dimensions have already been initialized.
const builtDimensions = new Set();

// Once the world is loaded, make sure each custom destination has a platform.
world.afterEvents.worldLoad.subscribe(() => {
  for (const platform of PLATFORMS) {
    ensurePlatformBuilt(platform);
  }
});

async function ensurePlatformBuilt(config: Platform) {
  if (builtDimensions.has(config.dimensionId)) {
    return;
  }

  const dim = world.getDimension(config.dimensionId);
  const tickingAreaId = `${config.dimensionId}_platform`;
  const margin = 2;

  // Keep the destination chunks active before trying to place blocks.
  await world.tickingAreaManager.createTickingArea(tickingAreaId, {
    dimension: dim,
    from: {
      x: config.center.x - config.radius - margin,
      y: config.center.y - 1,
      z: config.center.z - config.radius - margin,
    },
    to: {
      x: config.center.x + config.radius + margin,
      y: config.center.y + 4,
      z: config.center.z + config.radius + margin,
    },
  });

  buildPlatform(dim, config.blockId, config.radius, config.center, config.rails !== false);
  if (config.decor) {
    buildDecor(dim, config.center);
  }

  if (config.dimensionId === VOID_ARENA_ID) {
    world.structureManager.place("turn", dim, config.center);
  }

  // Clean up the temporary ticking area once the destination is ready.
  world.tickingAreaManager.removeTickingArea(tickingAreaId);
  builtDimensions.add(config.dimensionId);
}

// Build the floor first, then add simple glass rails around the edges.
function buildPlatform(dim: Dimension, blockId: string, radius: number, center: Vector3, rails: boolean) {
  const perm = BlockPermutation.resolve(blockId);

  for (let x = -radius; x <= radius; x++) {
    for (let z = -radius; z <= radius; z++) {
      dim.getBlock({ x: center.x + x, y: center.y, z: center.z + z })?.setPermutation(perm);
    }
  }

  if (!rails) return;

  const glass = BlockPermutation.resolve("minecraft:glass");
  for (let i = -radius; i <= radius; i++) {
    for (let y = 1; y <= 2; y++) {
      dim.getBlock({ x: center.x + i, y: center.y + y, z: center.z - radius })?.setPermutation(glass);
      dim.getBlock({ x: center.x + i, y: center.y + y, z: center.z + radius })?.setPermutation(glass);
      dim.getBlock({ x: center.x - radius, y: center.y + y, z: center.z + i })?.setPermutation(glass);
      dim.getBlock({ x: center.x + radius, y: center.y + y, z: center.z + i })?.setPermutation(glass);
    }
  }
}

// Add a little extra lighting to the decorated destination.
function buildDecor(dim: Dimension, center: Vector3) {
  const offsets = [-4, 4];
  const glowstone = BlockPermutation.resolve("minecraft:glowstone");

  for (const ox of offsets) {
    for (const oz of offsets) {
      dim.getBlock({ x: center.x + ox, y: center.y + 3, z: center.z + oz })?.setPermutation(glowstone);
    }
  }
}

interface DimensionDescription {
  label: string;
  id: string;
  spawn: Vector3;
}

// The menu includes both custom destinations and the vanilla dimensions.
var DIMENSIONS: DimensionDescription[] = [
  {
    label: `${Color.red}Void Arena ${Color.darkGray}(crimson platform in the void)${Color.reset}`,
    id: VOID_ARENA_ID,
    spawn: { x: 0, y: 66, z: 0 },
  },
  {
    label: `${Color.aqua}Sky Lounge ${Color.darkGray}(quartz platform high up)${Color.reset}`,
    id: SKY_LOUNGE_ID,
    spawn: { x: 0, y: 102, z: 0 },
  },
  {
    label: `${Color.yellow}Endless Runner ${Color.darkGray}(sprint & survive!)${Color.reset}`,
    id: ENDLESS_RUNNER_ID,
    spawn: { x: 0, y: 66, z: 0 },
  },
  {
    label: `${Color.green}Overworld${Color.reset}`,
    id: "minecraft:overworld",
    spawn: { x: 0, y: 64, z: 0 },
  },
  {
    label: `${Color.darkRed}The Nether${Color.reset}`,
    id: "minecraft:nether",
    spawn: { x: 0, y: 64, z: 0 },
  },
  {
    label: `${Color.purple}The End${Color.reset}`,
    id: "minecraft:the_end",
    spawn: { x: 0, y: 64, z: 0 },
  },
];

// Show a simple UI so players can pick where they want to go.
function showDimensionMenu(player: Player) {
  const form = new ActionFormData()
    .title(`${Color.bold}Dimension Traveler`)
    .body(`You are currently in: ${Color.aqua}${player.dimension.id}\n\n${Color.reset}Choose a destination:`);

  for (const dim of DIMENSIONS) {
    form.button(dim.label);
  }

  form.show(player as any).then((response) => {
    if (response.canceled || response.selection === void 0) {
      return;
    }

    const selected = DIMENSIONS[response.selection];
    if (selected.id === player.dimension.id) {
      player.sendMessage(`${Color.yellow}You are already in that dimension!`);
      return;
    }

    const isCustom = PLATFORMS.some((platform) => platform.dimensionId === selected.id);
    if (isCustom) {
      teleportToCustomDimension(player, selected);
    } else {
      system.run(() => {
        player.teleport(selected.spawn, { dimension: world.getDimension(selected.id) });
        player.sendMessage(`${Color.green}Teleported to ${selected.label}${Color.green}!`);
      });
    }
  });
}

// Custom dimensions need a loaded arrival area before the player is moved.
async function teleportToCustomDimension(player: Player, destination: DimensionDescription) {
  const dim = world.getDimension(destination.id);
  const tickingAreaId = `${destination.id}_teleport`;
  const spawn = destination.spawn;

  player.sendMessage(`${Color.yellow}Loading ${destination.label}${Color.yellow}...`);

  // Preload the area around the destination spawn point.
  await world.tickingAreaManager.createTickingArea(tickingAreaId, {
    dimension: dim,
    from: { x: spawn.x - 4, y: spawn.y - 4, z: spawn.z - 4 },
    to: { x: spawn.x + 4, y: spawn.y + 4, z: spawn.z + 4 },
  });

  const config = PLATFORMS.find((platform) => platform.dimensionId === destination.id);
  if (config) {
    await ensurePlatformBuilt(config);
  }

  player.teleport(spawn, { dimension: dim });
  player.sendMessage(`${Color.green}Teleported to ${destination.label}${Color.green}!`);

  world.tickingAreaManager.removeTickingArea(tickingAreaId);

  if (destination.id === ENDLESS_RUNNER_ID) {
    startRunner(player);
  }
}

// ---------------------------------------------------------------------------
// Endless Runner
// ---------------------------------------------------------------------------

const RUNNER_PATH_HALF_WIDTH = 1; // 3 blocks wide
const RUNNER_FLOOR_Y = 64;
const RUNNER_SEGMENT_LENGTH = 30;
const RUNNER_LOOK_AHEAD = 40;
const RUNNER_ZOMBIE_INTERVAL = 40; // ticks between zombie spawns (~2 sec)

const RUNNER_TICKING_AREA_ID = "endless_runner_ahead";

interface Direction {
  dx: number;
  dz: number;
}

function turnRight(dir: Direction): Direction {
  return { dx: -dir.dz, dz: dir.dx };
}

function turnLeft(dir: Direction): Direction {
  return { dx: dir.dz, dz: -dir.dx };
}

function sameDir(a: Direction, b: Direction): boolean {
  return a.dx === b.dx && a.dz === b.dz;
}

function cellKey(x: number, z: number): string {
  const cx = Math.round(x / RUNNER_SEGMENT_LENGTH);
  const cz = Math.round(z / RUNNER_SEGMENT_LENGTH);
  return `${cx},${cz}`;
}

interface RunnerState {
  active: boolean;
  headX: number;
  headZ: number;
  dir: Direction;
  occupiedCells: Set<string>;
  intervalId: number | undefined;
  zombies: Entity[];
  tickCount: number;
  lastTickingX: number;
  lastTickingZ: number;
}

const runner: RunnerState = {
  active: false,
  headX: 0,
  headZ: 0,
  dir: { dx: 0, dz: 1 },
  occupiedCells: new Set(),
  intervalId: undefined,
  zombies: [],
  tickCount: 0,
  lastTickingX: 0,
  lastTickingZ: 0,
};

async function startRunner(player: Player) {
  // Reset any previous run.
  stopRunner();

  const dim = world.getDimension(ENDLESS_RUNNER_ID);

  // Initialize direction: start heading +Z.
  runner.dir = { dx: 0, dz: 1 };
  runner.headX = 0;
  runner.headZ = 0;
  runner.occupiedCells = new Set();
  runner.occupiedCells.add(cellKey(0, 0));

  // Keep chunks loaded around the build area.
  runner.lastTickingX = 0;
  runner.lastTickingZ = 0;
  await updateRunnerTickingArea(dim, 0, 0);

  // Build the first ledge segment extending from the starting platform.
  generateNextSegment(dim);

  // Give the player a speed boost.
  player.addEffect("speed", 20 * 600, { amplifier: 1, showParticles: false });

  runner.active = true;
  runner.tickCount = 0;

  player.sendMessage(
    `${Color.yellow}${Color.bold}GO! ${Color.reset}${Color.gray}Run forward to survive. Zombies are coming!`
  );

  // Main game loop — runs every 5 ticks (4× per second).
  runner.intervalId = system.runInterval(() => {
    runner.tickCount += 5;

    // Stop if the player left the dimension.
    if (player.dimension.id !== ENDLESS_RUNNER_ID) {
      stopRunner();
      return;
    }

    // Stop if the player fell off (below the floor).
    if (player.location.y < RUNNER_FLOOR_Y - 10) {
      player.sendMessage(`${Color.red}${Color.bold}Game Over! ${Color.reset}${Color.gray}You fell off the path.`);
      stopRunner();
      return;
    }

    // Move the ticking area if the head has moved far from the last update.
    const tickDistX = Math.abs(runner.headX - runner.lastTickingX);
    const tickDistZ = Math.abs(runner.headZ - runner.lastTickingZ);
    if (tickDistX > 20 || tickDistZ > 20) {
      updateRunnerTickingArea(dim, runner.headX, runner.headZ);
    }

    // Extend the path when the player gets close to the head.
    const dxToHead = runner.headX - player.location.x;
    const dzToHead = runner.headZ - player.location.z;
    const distSq = dxToHead * dxToHead + dzToHead * dzToHead;
    if (distSq < RUNNER_LOOK_AHEAD * RUNNER_LOOK_AHEAD) {
      generateNextSegment(dim);
    }

    // Spawn a zombie behind the player on a regular cadence.
    if (runner.tickCount % RUNNER_ZOMBIE_INTERVAL === 0) {
      spawnRunnerZombie(dim, player);
    }

    // Clean up zombies that fell into the void.
    runner.zombies = runner.zombies.filter((z) => {
      if (!z.isValid || z.location.y < RUNNER_FLOOR_Y - 20) {
        if (z.isValid) z.remove();
        return false;
      }
      return true;
    });
  }, 5);
}

// Pick a direction (straight, left, or right) that doesn't revisit a used cell.
function generateNextSegment(dim: Dimension) {
  const straight = runner.dir;
  const left = turnLeft(runner.dir);
  const right = turnRight(runner.dir);

  const candidates = [straight, left, right].filter((d) => {
    const newX = runner.headX + d.dx * RUNNER_SEGMENT_LENGTH;
    const newZ = runner.headZ + d.dz * RUNNER_SEGMENT_LENGTH;
    return !runner.occupiedCells.has(cellKey(newX, newZ));
  });

  // Default to straight if everything is blocked.
  let chosen: Direction;
  if (candidates.length === 0) {
    chosen = straight;
  } else if (candidates.some((c) => sameDir(c, straight)) && Math.random() < 0.5) {
    // 50 % bias towards continuing straight.
    chosen = straight;
  } else {
    chosen = candidates[Math.floor(Math.random() * candidates.length)];
  }

  // If turning, fill a small corner pad so the player doesn't fall at the junction.
  if (!sameDir(chosen, runner.dir)) {
    fillCorner(dim, runner.headX, runner.headZ);
  }

  runner.dir = chosen;

  buildLedgeSegment(dim, runner.headX, runner.headZ, chosen, RUNNER_SEGMENT_LENGTH);

  runner.headX += chosen.dx * RUNNER_SEGMENT_LENGTH;
  runner.headZ += chosen.dz * RUNNER_SEGMENT_LENGTH;
  runner.occupiedCells.add(cellKey(runner.headX, runner.headZ));
}

// Build one straight ledge segment in an arbitrary axis-aligned direction.
function buildLedgeSegment(dim: Dimension, fromX: number, fromZ: number, dir: Direction, length: number) {
  const hw = RUNNER_PATH_HALF_WIDTH;
  const y = RUNNER_FLOOR_Y;

  const toX = fromX + dir.dx * (length - 1);
  const toZ = fromZ + dir.dz * (length - 1);

  // Width is perpendicular to the direction of travel.
  const xMin = Math.min(fromX, toX) - Math.abs(dir.dz) * hw;
  const xMax = Math.max(fromX, toX) + Math.abs(dir.dz) * hw;
  const zMin = Math.min(fromZ, toZ) - Math.abs(dir.dx) * hw;
  const zMax = Math.max(fromZ, toZ) + Math.abs(dir.dx) * hw;

  dim.fillBlocks(
    new BlockVolume({ x: xMin, y, z: zMin }, { x: xMax, y, z: zMax }),
    BlockPermutation.resolve("minecraft:deepslate_bricks"),
    { ignoreChunkBoundErrors: true }
  );

  // Glowstone lighting every 10 blocks on both edges.
  const glow = BlockPermutation.resolve("minecraft:glowstone");
  const perpX = Math.abs(dir.dz);
  const perpZ = Math.abs(dir.dx);
  for (let i = 0; i < length; i += 10) {
    const bx = fromX + dir.dx * i;
    const bz = fromZ + dir.dz * i;
    dim.getBlock({ x: bx - perpX * (hw + 1), y, z: bz - perpZ * (hw + 1) })?.setPermutation(glow);
    dim.getBlock({ x: bx + perpX * (hw + 1), y, z: bz + perpZ * (hw + 1) })?.setPermutation(glow);
  }
}

// Small square pad at a turn so the player can navigate the corner.
function fillCorner(dim: Dimension, x: number, z: number) {
  const pad = RUNNER_PATH_HALF_WIDTH + 1;
  dim.fillBlocks(
    new BlockVolume({ x: x - pad, y: RUNNER_FLOOR_Y, z: z - pad }, { x: x + pad, y: RUNNER_FLOOR_Y, z: z + pad }),
    BlockPermutation.resolve("minecraft:deepslate_bricks"),
    { ignoreChunkBoundErrors: true }
  );
}

async function updateRunnerTickingArea(dim: Dimension, centerX: number, centerZ: number) {
  if (world.tickingAreaManager.hasTickingArea(RUNNER_TICKING_AREA_ID)) {
    world.tickingAreaManager.removeTickingArea(RUNNER_TICKING_AREA_ID);
  }

  await world.tickingAreaManager.createTickingArea(RUNNER_TICKING_AREA_ID, {
    dimension: dim,
    from: { x: centerX - 50, y: RUNNER_FLOOR_Y - 2, z: centerZ - 50 },
    to: { x: centerX + 50, y: RUNNER_FLOOR_Y + 10, z: centerZ + 50 },
  });

  runner.lastTickingX = centerX;
  runner.lastTickingZ = centerZ;
}

function spawnRunnerZombie(dim: Dimension, player: Player) {
  // Spawn a pair of zombies behind the player, spread across the path width.
  const behindX = Math.floor(player.location.x) - runner.dir.dx * 10;
  const behindZ = Math.floor(player.location.z) - runner.dir.dz * 10;
  const perpX = Math.abs(runner.dir.dz);
  const perpZ = Math.abs(runner.dir.dx);

  for (const side of [-1, 1]) {
    const zombie = dim.spawnEntity("minecraft:zombie", {
      x: behindX + perpX * side,
      y: RUNNER_FLOOR_Y + 1,
      z: behindZ + perpZ * side,
    });

    zombie.addEffect("speed", 20 * 120, { amplifier: 2, showParticles: false });
    runner.zombies.push(zombie);
  }
}

function stopRunner() {
  if (runner.intervalId !== undefined) {
    system.clearRun(runner.intervalId);
    runner.intervalId = undefined;
  }

  for (const z of runner.zombies) {
    if (z.isValid) z.remove();
  }
  runner.zombies = [];
  runner.active = false;
  runner.headX = 0;
  runner.headZ = 0;
  runner.dir = { dx: 0, dz: 1 };
  runner.occupiedCells = new Set();
  runner.tickCount = 0;
  runner.lastTickingX = 0;
  runner.lastTickingZ = 0;

  if (world.tickingAreaManager.hasTickingArea(RUNNER_TICKING_AREA_ID)) {
    world.tickingAreaManager.removeTickingArea(RUNNER_TICKING_AREA_ID);
  }
}
