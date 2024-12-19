import { world, system, EntitySpawnAfterEvent } from "@minecraft/server";

function mainTick() {

  world.afterEvents.entitySpawn.subscribe(handleNewMob);

}

function handleNewMob(event: EntitySpawnAfterEvent) {

  if (event.entity.typeId === "mike_eliz:eliza") {
    world.playSound("meow", event.entity.location);

    event.entity.nameTag = "Eliza";
  }
}

system.run(mainTick);
