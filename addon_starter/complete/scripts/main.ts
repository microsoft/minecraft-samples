import { world, system, BlockPermutation, ButtonPushAfterEvent } from "@minecraft/server";
import Utilities from "./Utilities";

let ticksSinceLoad = 0;

const ZooMobList = ["aop_mobs:biceson", "aop_mobs:frost_moose", "aop_mobs:sheepomelon"];

function mainTick() {
  ticksSinceLoad++;

  if (ticksSinceLoad === 100) {
    world.sendMessage("Welcome to the wacky zoo!");
    initialize();
  }

  system.run(mainTick);
}

function getTriggerLoc() {
  const spawnLoc = world.getDefaultSpawnLocation();

  const x = spawnLoc.x - 5;
  const z = spawnLoc.z - 5;
  const y = findTopmostBlockUsingPlayer(x, z);

  return { x: x, y: y, z: z };
}

function getZooLoc() {
  const spawnLoc = world.getDefaultSpawnLocation();
  const x = spawnLoc.x - 25;
  const z = spawnLoc.z - 25;
  const y = findTopmostBlockUsingPlayer(x, z);

  return { x: x, y: y, z: z };
}

function findTopmostBlockUsingPlayer(x: number, z: number) {
  const ow = world.getDimension("overworld");

  let y = -60;

  const players = world.getPlayers();

  // use a little bit below the player's Y to suggest a location. Move upward until we find air.
  if (players.length > 0) {
    y = Math.max(players[0].location.y - 8, -62);

    let block = ow.getBlock({ x: x, y: y, z: z });

    while (block && !block.permutation.matches("minecraft:air")) {
      y++;

      block = ow.getBlock({ x: x, y: y, z: z });
    }
  }

  return y;
}

function initialize() {
  const overworld = world.getDimension("overworld");

  const triggerLoc = getTriggerLoc();

  // set up a button on cobblestone
  const cobblestone = overworld.getBlock(triggerLoc);
  const button = overworld.getBlock({ x: triggerLoc.x, y: triggerLoc.y + 1, z: triggerLoc.z });

  if (cobblestone === undefined || button === undefined) {
    console.warn("Could not load the position to place our switch.");
    return -1;
  }
  world.sendMessage("Adding a button at x: " + triggerLoc.x + " y:" + triggerLoc.y + " z: " + triggerLoc.z);
  cobblestone.setPermutation(BlockPermutation.resolve("cobblestone"));
  button.setPermutation(BlockPermutation.resolve("acacia_button", { facing_direction: 1 } /* up */));

  world.afterEvents.buttonPush.subscribe(spawnZoo);
}

function spawnZoo() {
  const zooLoc = getZooLoc();

  const overworld = world.getDimension("overworld");

  Utilities.fourWalls(
    BlockPermutation.resolve("minecraft:glass"),
    zooLoc.x - 20,
    zooLoc.y + 20,
    zooLoc.z - 20,
    zooLoc.x,
    zooLoc.y,
    zooLoc.z
  );

  let mobLoc = { x: zooLoc.x - 2, y: zooLoc.y, z: zooLoc.z - 2 };

  for (const mob of ZooMobList) {
    world.sendMessage("Spawning mob: " + mob);
    overworld.spawnEntity(mob, mobLoc);

    mobLoc = { x: mobLoc.x - 2, y: mobLoc.y + 1, z: mobLoc.z - 2 };
  }
}

system.run(mainTick);
