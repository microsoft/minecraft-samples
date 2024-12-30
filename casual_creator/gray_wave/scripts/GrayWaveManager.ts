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

      if (players.length - 1 <= playerIndexToProcess) {
        const player = players[playerIndexToProcess];

        this.processGraywaveItemsAroundPlayer(player);
      }
    }
  }

  log(message: string) {
    if (this.isDebug) {
      world.sendMessage(message);
    }
  }

  processGraywaveItemsAroundPlayer(player: Player) {
    const graywaveItems = player.dimension.getEntities({
      location: player.location,
      families: ["graywave"],
      maxDistance: 50,
    });

    for (const entity of graywaveItems) {
      const typeId = entity.typeId;

      if (typeId === "mikeamm_gwve:crossbow_turret") {
        const generators = player.dimension.getEntities({
          location: player.location,
          type: "mikeamm_gwve:gray_wave_generator",
          maxDistance: 50,
        });

        let foundGen = false;

        for (const gen of generators) {
          foundGen = true;
          break;
        }
      }
    }
  }

  static isGraywaveConsumer(entity: Entity) {
    const typeFamilies = entity.getComponent("minecraft:type_family") as EntityTypeFamilyComponent;

    if (!typeFamilies) {
      return false;
    }

    return typeFamilies.hasTypeFamily("graywave_consumer");
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
