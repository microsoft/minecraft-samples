import { Vector3Builder, Vector3Utils } from "@minecraft/math";
import {
  Dimension,
  Entity,
  EntityInventoryComponent,
  EntityTypeFamilyComponent,
  ItemUseAfterEvent,
  Player,
  system,
  Vector3,
  world,
} from "@minecraft/server";

export default class GrayWaveManager {
  isDebug = false;

  get lastHordeTick() {
    const result = world.getDynamicProperty("mikeamm_gwve:lastHordeTick");

    if (typeof result === "number") {
      return result;
    }

    return -1;
  }

  set lastHordeTick(newHordeTick: number) {
    world.setDynamicProperty("mikeamm_gwve:lastHordeTick", newHordeTick);
  }

  get nextHordeInterval() {
    const result = world.getDynamicProperty("mikeamm_gwve:nextHordeInterval");

    if (typeof result === "number") {
      return result;
    }

    return -1;
  }

  set nextHordeInterval(newHordeTick: number) {
    world.setDynamicProperty("mikeamm_gwve:nextHordeInterval", newHordeTick);
  }

  constructor() {
    this.handleItemUse = this.handleItemUse.bind(this);
  }

  init() {
    world.afterEvents.itemUse.subscribe(this.handleItemUse);
  }

  tick(tickIndex: number) {
    if (tickIndex % 20 === 0) {
      this.considerWhetherToSpawnHorde();
    }

    const playerIndexToProcess = tickIndex % 60;

    // every 60 ticks, process one player per tick
    if (playerIndexToProcess < 20) {
      const players = world.getAllPlayers();

      if (playerIndexToProcess < players.length) {
        const player = players[playerIndexToProcess];

        this.processGrayWaveItemsAroundPlayer(player);
      }
    }
  }

  log(message: string) {
    if (this.isDebug) {
      console.warn(message);
    }
  }

  considerWhetherToSpawnHorde() {
    if (this.nextHordeInterval === -1) {
      this.generateNextHordeInterval();
    }

    // we've exceeded a time threshhold, consider whether we have an active graywave consumer
    if (system.currentTick > this.lastHordeTick + this.nextHordeInterval) {
      const consumers = this.getAllActiveGrayWaveConsumers();

      if (consumers.length > 0) {
        const candidateConsumer = consumers[Math.floor(Math.random() * consumers.length)];

        const sourceGenerator = this.getConnectedGenerator(candidateConsumer);

        if (candidateConsumer && sourceGenerator) {
          this.spawnHorde(candidateConsumer, sourceGenerator, consumers.length);
        }
      }
    }
  }

  spawnHorde(consumer: Entity, generator: Entity, intensity: number) {
    const dist = Vector3Utils.normalize(Vector3Utils.subtract(consumer.location, generator.location));

    const targetDist = Vector3Utils.multiply(dist, {
      x: Math.random() * 10 + 25,
      y: Math.random() * 10 + 25,
      z: Math.random() * 10 + 25,
    });

    let spawnCenterPointStart = {
      x: consumer.location.x + targetDist.x + (Math.random() * 20 - 10),
      z: consumer.location.z + targetDist.z + (Math.random() * 20 - 10),
    };

    let topMost = consumer.dimension.getTopmostBlock(spawnCenterPointStart);

    if (!topMost) {
      this.log(
        "Could not find a top most block at candidate spawn point" +
          spawnCenterPointStart.x +
          ", " +
          spawnCenterPointStart.z
      );
      return;
    }

    let numbersToSpawn = Math.floor(Math.random() * 3 + Math.random() * intensity * 2) + 2;

    consumer.dimension.playSound("raid.horn", topMost.location);

    this.log(
      "Spawning horde of " +
        numbersToSpawn +
        " near " +
        consumer.id +
        " (" +
        spawnCenterPointStart.x +
        ", " +
        spawnCenterPointStart.z +
        ")"
    );

    this.generateGrayWaveBetweenLocations(consumer.dimension, consumer.location, topMost.location);

    for (let i = 0; i < numbersToSpawn; i++) {
      const spawnLoc = {
        x: spawnCenterPointStart.x + (Math.random() * 20 - 10),
        z: spawnCenterPointStart.z + (Math.random() * 20 - 10),
      };

      let spawnTopMost = consumer.dimension.getTopmostBlock(spawnLoc);

      if (spawnTopMost) {
        let mobToSpawn = "minecraft:skeleton";

        if (i === 0) {
          mobToSpawn = "mikeamm_gwve:gray_zombie_leader";
        } else {
          switch (Math.floor(Math.random() * 3)) {
            case 0:
              mobToSpawn = "minecraft:zombie";
              break;
            case 1:
              mobToSpawn = "minecraft:witch";
              break;
            case 2:
              mobToSpawn = "minecraft:skeleton";
              break;
            case 2:
              mobToSpawn = "minecraft:evocation_illager";
              break;
            case 2:
              mobToSpawn = "minecraft:pillager";
              break;
          }
        }

        try {
          consumer.dimension.spawnEntity(mobToSpawn, {
            x: spawnTopMost.location.x,
            y: spawnTopMost.location.y + 2,
            z: spawnTopMost.location.z,
          });
        } catch (e) {}
      }
    }

    this.lastHordeTick = system.currentTick;
    this.generateNextHordeInterval();
  }

  lineOfSightBetween(dimension: Dimension, startLoc: Vector3, endLoc: Vector3) {
    const dist = Vector3Utils.distance(startLoc, endLoc);

    const numbersToProvision = Math.floor(dist);

    for (let i = 0; i < numbersToProvision; i++) {
      let curLoc = {
        x: startLoc.x + ((endLoc.x - startLoc.x) * i) / numbersToProvision,
        y: startLoc.y + ((endLoc.y - startLoc.y) * i) / numbersToProvision,
        z: startLoc.z + ((endLoc.z - startLoc.z) * i) / numbersToProvision,
      };

      let interimBlock = dimension.getBlock(curLoc);

      if (interimBlock) {
        const targetBlock = interimBlock.above(1);

        if (targetBlock) {
          if (targetBlock.typeId !== "minecraft:air") {
            return false;
          }
        }
      }
    }
    return true;
  }

  generateGrayWaveBetweenLocations(dimension: Dimension, startLoc: Vector3, endLoc: Vector3) {
    const dist = Vector3Utils.distance(startLoc, endLoc);

    const numbersToProvision = Math.floor(dist / 6);

    for (let i = 0; i < numbersToProvision; i++) {
      let curLoc = {
        x: startLoc.x + ((endLoc.x - startLoc.x) * i) / numbersToProvision,
        z: startLoc.z + ((endLoc.z - startLoc.z) * i) / numbersToProvision,
      };

      let topMost = dimension.getTopmostBlock(curLoc);

      if (topMost) {
        const targetBlock = topMost.above(2);

        if (targetBlock) {
          const existingGrayWave = dimension.getEntities({
            location: topMost.location,
            type: "mikeamm_gwve:gray_wave",
            maxDistance: 2,
          });

          if (existingGrayWave.length === 0) {
            try {
              dimension.spawnEntity("mikeamm_gwve:gray_wave", targetBlock.location);
            } catch (e) {}
          }
        }
      }
    }
  }

  generateNextHordeInterval() {
    // every 100-200 seconds
    this.nextHordeInterval = Math.floor(Math.random() * 2000 + 2000);
  }

  getAllActiveGrayWaveConsumers() {
    const players = world.getAllPlayers();
    const consumerEntities: Entity[] = [];

    for (const player of players) {
      const graywaveItems = player.dimension.getEntities({
        location: player.location,
        families: ["gray_wave"],
        maxDistance: 50,
      });

      for (const entity of graywaveItems) {
        const isConsumer = GrayWaveManager.isGrayWaveConsumer(entity);

        if (isConsumer) {
          const grayWaveState = entity.getProperty("mikeamm_gwve:state");

          if (grayWaveState === "active") {
            consumerEntities.push(entity);
          }
        }
      }
    }

    return consumerEntities;
  }

  getConnectedGenerator(entity: Entity) {
    const generators = entity.dimension.getEntities({
      location: entity.location,
      type: "mikeamm_gwve:gray_wave_generator",
      maxDistance: 30,
    });

    for (const gen of generators) {
      if (gen.dimension.id === entity.dimension.id) {
        if (this.lineOfSightBetween(entity.dimension, entity.location, gen.location)) {
          return gen;
        }
      }
    }

    return undefined;
  }

  processGrayWaveItemsAroundPlayer(player: Player) {
    const graywaveItems = player.dimension.getEntities({
      location: player.location,
      families: ["gray_wave"],
      maxDistance: 50,
    });

    for (const entity of graywaveItems) {
      const isConsumer = GrayWaveManager.isGrayWaveConsumer(entity);

      if (isConsumer) {
        const connectedGen = this.getConnectedGenerator(entity);
        const grayWaveState = entity.getProperty("mikeamm_gwve:state");

        if (grayWaveState === "inactive" && connectedGen) {
          this.log("Gray wave generator is close. Activating " + entity.id);

          entity.dimension.playSound("beacon.activate", entity.location);

          entity.triggerEvent("mikeamm_gwve:activate");
        } else if (grayWaveState === "active" && !connectedGen) {
          this.log("No nearby gray wave generator. Deactivating " + entity.id);
          entity.dimension.playSound("beacon.deactivate", entity.location);
          entity.triggerEvent("mikeamm_gwve:deactivate");
        }
      }
    }
  }

  static isGrayWaveConsumer(entity: Entity) {
    const typeFamilies = entity.getComponent("minecraft:type_family") as EntityTypeFamilyComponent;

    if (!typeFamilies) {
      return false;
    }

    return typeFamilies.hasTypeFamily("gray_wave_consumer");
  }

  handleItemUse(evt: ItemUseAfterEvent) {
    if (!evt.source) {
      return;
    }

    switch (evt.itemStack.typeId) {
      case "mikeamm_gwve:crossbow_turret_kit":
        this.removeItem(evt.source, evt.itemStack.typeId);
        break;
    }
  }

  removeItem(player: Player, typeId: string) {
    let inventory = player.getComponent("minecraft:inventory") as EntityInventoryComponent;

    let container = inventory.container;
    if (!container) {
      return;
    }

    for (let i = player.selectedSlotIndex; i < 30; i++) {
      const item = container.getItem(i);

      if (item?.typeId === typeId) {
        if (item.amount === 1) {
          container.setItem(i, undefined);
          return;
        } else {
          item.amount = item.amount - 1;
          container.setItem(i, item);
          return;
        }
      }
    }
  }
}
