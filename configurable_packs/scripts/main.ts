import { world, system, WorldLoadAfterEvent } from "@minecraft/server";
world.afterEvents.worldLoad.subscribe((event: WorldLoadAfterEvent) => {
  world.afterEvents.playerInteractWithBlock.subscribe((event) => {
    const packSettings = world.getPackSettings();

    const explosionSize = packSettings["mypack:explosion_power"];

    if (packSettings["mypack:explosion_hands"] === true && explosionSize && typeof explosionSize === "number") {
      const player = event.player;
      const block = event.block;

      if (block && player && !block.isAir) {
        world.sendMessage("Explosion hands go boom! " + explosionSize);
        block.dimension.createExplosion(block.location, explosionSize, {
          source: player,
          causesFire: false,
          breaksBlocks: true,
        });
      }
    }
  });
});
