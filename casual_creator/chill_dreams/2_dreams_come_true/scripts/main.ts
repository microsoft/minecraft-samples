import {
  world,
  system,
  PlayerJoinAfterEvent,
  Player,
  ItemUseAfterEvent,
  Entity,
  ItemStartUseAfterEvent,
  ItemStopUseAfterEvent,
  PlayerSpawnAfterEvent,
  EntityDieAfterEvent,
} from "@minecraft/server";
import { ActionFormData, ModalFormData, ModalFormResponse } from "@minecraft/server-ui";
import Utilities from "./Utilities";
import IPlayerSettings from "./IPlayerSettings";
import Dream from "./Dream";

let tickCount = 0;

const activeDreams: { [playerId: string]: Dream | undefined } = {};

let tickTurkeyStartEating = -1;

function mainLoop() {
  if (tickCount === 60) {
    initializeWorld();
  }

  for (const dreamingPlayerId in activeDreams) {
    const dream = activeDreams[dreamingPlayerId];

    if (dream) {
      dream.tick();
    }
  }

  tickCount++;
  system.run(mainLoop);
}

function initializeWorld() {
  // turn off command feedback
  world.getDimension("overworld").runCommand("gamerule sendcommandfeedback false");

  const allPlayers = world.getAllPlayers();

  for (const player of allPlayers) {
    clearDream(player);
  }
}

function playerSpawned(event: PlayerSpawnAfterEvent) {
  if (event.initialSpawn) {
    provisionPlayer(event.player);

    clearDream(event.player);
  }
}

function clearDream(player: Player) {
  if (activeDreams[player.id]) {
    activeDreams[player.id] = undefined;
  }

  // restore player back to where they were before the dream started
  const predreamState = world.getDynamicProperty(player.id + "predream");

  if (predreamState && typeof predreamState === "string") {
    try {
      const predreamObj = JSON.parse(predreamState) as IPlayerSettings;

      if (predreamObj) {
        player.teleport(predreamObj.location, {
          dimension: world.getDimension(predreamObj.dimensionId),
        });

        player.runCommand("gamemode default @s");
        player.runCommand("inputpermission set @s camera enabled");
      }
    } catch (e) {}

    world.setDynamicProperty(player.id + "predream", undefined);
  }
}

function provisionPlayer(player: Player) {
  let isProvisioned = player.getDynamicProperty("cds-provisioned");

  if (!isProvisioned) {
  }
}

function startAfterItemUse(event: ItemStartUseAfterEvent) {
  if (!event.source || event.source.typeId !== "minecraft:player") {
    return;
  }

  if (event.itemStack.typeId === "mamm_cds:cooked_dream_turkey") {
    tickTurkeyStartEating = tickCount;
  }
}

function stopAfterItemUse(event: ItemStopUseAfterEvent) {
  if (!event.source || event.source.typeId !== "minecraft:player") {
    return;
  }

  if (event.itemStack && event.itemStack.typeId === "mamm_cds:cooked_dream_turkey") {
    // UH OH GETTING SLEEPY
    if (tickCount - tickTurkeyStartEating > 60 && event.source && event.source.typeId === "minecraft:player") {
      startDreamSleep(event.source as Player);
    }
  }
}

function startDreamSleep(player: Player) {
  player.onScreenDisplay.setActionBar("§oYou're getting sleepy...§r");
  player.onScreenDisplay.setTitle(" ", {
    fadeInDuration: 20,
    fadeOutDuration: 20,
    stayDuration: 100,
  });

  player.camera.fade({
    fadeColor: { red: 0, green: 0, blue: 0 },
    fadeTime: {
      fadeInTime: 3,
      fadeOutTime: 3,
      holdTime: 10,
    },
  });

  const playerId = player.id;

  // start the dream in 3 seconds after we've faded to black.
  system.runTimeout(async () => {
    // re-fetch the player to ensure we have a fresh player 60 ticks later...
    const uiPlayer = Utilities.getPlayerById(playerId);

    if (uiPlayer) {
      startDream(uiPlayer);
    }
  }, 60);
}

async function startDream(player: Player) {
  let dream = activeDreams[player.id];

  if (dream === undefined) {
    dream = new Dream(player.id);
  }

  dream.clearDreamCallback = clearDream;

  let spawnPoint = player.getSpawnPoint();
  let spawnLoc = undefined;
  let spawnDimensionId = undefined;

  if (spawnPoint) {
    spawnLoc = { x: spawnPoint.x, y: player.location.y, z: spawnPoint.z };
    spawnDimensionId = spawnPoint.dimension.id;
  }

  if (spawnLoc === undefined || spawnDimensionId === undefined) {
    spawnLoc = world.getDefaultSpawnLocation();

    spawnLoc = { x: spawnLoc.x, y: player.location.y, z: spawnLoc.z };
    spawnDimensionId = "overworld";
  }

  dream.addPoint(player.location, player.dimension.id, "Napping Point");
  dream.addPoint(spawnLoc, spawnDimensionId, "Bed");

  dream.activate();

  activeDreams[player.id] = dream;

  const modalForm = new ModalFormData()
    .title("Dream Preferences")
    .title("Dream")
    .toggle("...around your memories")
    .toggle("...about random places")
    .toggle("...nightmares");

  let response: ModalFormResponse | undefined = undefined;
  try {
    response = await modalForm.show(player);
  } catch (e) {}

  if (response && response.formValues && response.formValues.length > 1) {
    if (response.formValues[0]) {
      dream.generateAdditionalNearReferencePoints();
    }
    if (response.formValues[2]) {
      dream.generateAdditionalNetherPoints();
    }
    if (response.formValues[1]) {
      dream.generateAdditionalRandomPoints();
    }
  }
}

world.afterEvents.playerSpawn.subscribe(playerSpawned);
world.afterEvents.itemStartUse.subscribe(startAfterItemUse);
world.afterEvents.itemStopUse.subscribe(stopAfterItemUse);
system.run(mainLoop);
