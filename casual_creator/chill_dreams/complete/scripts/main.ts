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
import MemorySet from "./MemorySet";
import { ActionFormData, MessageFormData, ModalFormData, ModalFormResponse } from "@minecraft/server-ui";
import Utilities from "./Utilities";
import IPlayerSettings from "./IPlayerSettings";
import Dream from "./Dream";

let tickCount = 0;

const activeDreams: { [playerId: string]: Dream | undefined } = {};

const memorySet = new MemorySet();
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

  dream.setupDreamFromMemories(memorySet);

  dream.activate();

  activeDreams[player.id] = dream;

  const modalForm = new ModalFormData()
    .title("Dream Preferences")
    .title("Dream")
    .toggle("...at your nap spot and bed", true)
    .toggle("...around your memories")
    .toggle("...about random places")
    .toggle("...nightmares");

  let response: ModalFormResponse | undefined = undefined;
  try {
    response = await modalForm.show(player);
  } catch (e) {}

  if (response && response.formValues && response.formValues.length > 1) {
    if (response.formValues[0] === true || memorySet.getMemories().length) {
      dream.addPoint(player.location, player.dimension.id, "Napping Point");
      dream.addPoint(spawnLoc, spawnDimensionId, "Bed");
    }
    if (response.formValues[1] === true) {
      dream.generateAdditionalNearReferencePoints();
    }
    if (response.formValues[2] === true) {
      dream.generateAdditionalRandomPoints();
    }
    if (response.formValues[3] === true) {
      dream.generateAdditionalNetherPoints();
    }
  }
}

function afterItemUse(event: ItemUseAfterEvent) {
  if (!event.source || event.source.typeId !== "minecraft:player") {
    return;
  }

  if (event.itemStack.typeId === "mamm_cds:journal") {
    useJournalBook(event.source as Player);
  } else if (event.itemStack.typeId === "mamm_cds:journal_pencil") {
    useJournalPen(event.source as Player);
  }
}

function entityDie(event: EntityDieAfterEvent) {
  if (!event.deadEntity || event.deadEntity.typeId !== "mamm_cds:memory_jar") {
    return;
  }

  let memory = memorySet.getMemory(event.deadEntity.id);

  if (!memory) {
    memory = memorySet.getMemoryNear(event.deadEntity.location, event.deadEntity.dimension.id);
  }

  if (memory) {
    memorySet.removeMemoryOnly(memory);
  }
}

async function useJournalBook(player: Player) {
  const afd = new ActionFormData().title("Memories");

  let bodyStr = "Dream Journal Pen Recipe: Brown Concrete, Dream Essence (from Dream Turkeys), Stick";

  const memoryList = memorySet.getMemories();

  if (memoryList.length === 0) {
    afd.button("No memories are available.");
  }

  afd.body(bodyStr);

  for (let i = 0; i < memoryList.length; i++) {
    afd.button(memoryList[i].getEffectiveTitle());
  }

  let response = undefined;
  try {
    response = await afd.show(player);
  } catch (e) {}

  if (response && !response.canceled && response.selection !== undefined) {
    if (memoryList.length === 0 && response.selection === 0) {
      const instructionD = new MessageFormData().body(
        "Memories influence your dreams. You can also use your dream journal to revisit your memories.\r\n\r\nCapture memories with a dream journal pen (brown hardened clay, dream essence, and sticks). Get dream essence from dream turkeys."
      );

      instructionD.button1("Cancel");
      instructionD.button2("Got it!");

      await instructionD.show(player);
      return;
    }

    const memory = memoryList[response.selection];

    if (memory && memory.location && memory.dimensionId) {
      player.camera.fade({
        fadeColor: { red: 0, green: 0, blue: 0 },
        fadeTime: {
          fadeInTime: 2,
          fadeOutTime: 2,
          holdTime: 0,
        },
      });

      const playerId = player.id;
      const memLoc = memory.location;
      const memDim = memory.dimensionId;

      player.onScreenDisplay.setTitle(" ", {
        subtitle: "§oI remember " + memory.getEffectiveTitle() + "...§r",
        fadeInDuration: 8,
        fadeOutDuration: 8,
        stayDuration: 40,
      });

      system.runTimeout(async () => {
        const uiPlayer = Utilities.getPlayerById(playerId);

        if (uiPlayer) {
          player.teleport(memLoc, {
            dimension: world.getDimension(memDim),
          });
        }
      }, 40);
    }
  }
}

async function useJournalPen(player: Player) {
  const memory = ensureMemoryNearPlayer(player);

  await memory.showEditor(player);
}

function ensureMemoryNearPlayer(player: Player) {
  let memoryEntity: Entity | undefined = undefined;

  // if a player is looking at a memory, use that.
  const entitiesFromView = player.getEntitiesFromViewDirection();

  for (const entityHit of entitiesFromView) {
    if (entityHit.entity.typeId === "mamm_cds:memory_jar") {
      memoryEntity = entityHit.entity;
    }
  }

  if (memoryEntity === undefined) {
    const entities = player.dimension.getEntities({
      location: player.location,
      type: "mamm_cds:memory_jar",
      maxDistance: 10,
    });

    if (entities && entities.length > 0) {
      memoryEntity = entities[0];
    }
  }

  if (memoryEntity === undefined) {
    const viewDirection = player.getViewDirection();
    const targetLoc = {
      x: player.location.x + viewDirection.x,
      y: player.location.y,
      z: player.location.z + viewDirection.z,
    };

    // is there a memory but no corresponding jar? if yes, re-attach
    // that memory to the new memory.
    const existingMemory = memorySet.getMemoryNear(targetLoc, player.dimension.id);

    memoryEntity = player.dimension.spawnEntity("mamm_cds:memory_jar", targetLoc);

    if (existingMemory) {
      // technically remove the old memory
      memorySet.removeMemoryOnly(existingMemory);

      // add a new memory and restore the title.
      const memory = memorySet.ensureMemory(memoryEntity.id);
      memory.title = existingMemory.title;
    }
  }

  const memory = memorySet.ensureMemory(memoryEntity.id);

  memory.location = memoryEntity.location;
  memory.dimensionId = memoryEntity.dimension.id;

  memorySet.save();

  return memory;
}

world.afterEvents.playerSpawn.subscribe(playerSpawned);
world.afterEvents.itemUse.subscribe(afterItemUse);
world.afterEvents.itemStartUse.subscribe(startAfterItemUse);
world.afterEvents.itemStopUse.subscribe(stopAfterItemUse);
world.afterEvents.entityDie.subscribe(entityDie);
system.run(mainLoop);
