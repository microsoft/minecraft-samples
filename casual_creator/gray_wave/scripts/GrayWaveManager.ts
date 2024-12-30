import { Vector3Utils } from "@minecraft/math";
import {
  Entity,
  EntityInventoryComponent,
  EntityTypeFamilyComponent,
  ItemUseAfterEvent,
  Player,
  world,
} from "@minecraft/server";

export default class GrayWaveManager {
  isDebug = true;

  constructor() {
    this.handleItemUse = this.handleItemUse.bind(this);
  }

  init() {
    world.afterEvents.itemUse.subscribe(this.handleItemUse);
  }

  tick(tickIndex: number) {
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
      world.sendMessage(message);
    }
  }

  processGrayWaveItemsAroundPlayer(player: Player) {
    const graywaveItems = player.dimension.getEntities({
      location: player.location,
      families: ["gray_wave"],
      maxDistance: 50,
    });

    for (const entity of graywaveItems) {
      const typeId = entity.typeId;

      const isConsumer = GrayWaveManager.isGrayWaveConsumer(entity);

      if (isConsumer) {
        const generators = player.dimension.getEntities({
          location: player.location,
          type: "mikeamm_gwve:gray_wave_generator",
          maxDistance: 50,
        });

        let foundGen = false;

        for (const gen of generators) {
          foundGen = true; // add a more sophisticated line of sight calculator, but for now, if we find a generator in range, let's support it
          break;
        }

        const grayWaveState = entity.getProperty("mikeamm_gwve:state");

        if (grayWaveState === "inactive" && foundGen) {
          this.log("Gray wave generator is close. Activating " + entity.id);

          entity.triggerEvent("mikeamm_gwve:activate");
        } else if (grayWaveState === "active" && !foundGen) {
          this.log("No nearby gray wave generator. Deactivating " + entity.id);

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
