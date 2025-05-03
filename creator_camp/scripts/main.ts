import {
  BlockComponentStepOnEvent,
  BlockComponentPlayerInteractEvent,
  EntityComponentTypes,
  system,
} from "@minecraft/server";
import { BlockStateSuperset, MinecraftItemTypes } from "@minecraft/vanilla-data";
import { LeafPileInteractionCustomComponent } from "./LeafPileInteractionCustomComponent";
import { ThrowLeavesCustomComponent } from "./ThrowLeavesCustomComponent";

function stompOnBlock(event: BlockComponentStepOnEvent) {
  const state = event.block.permutation.getState("creatorcamp:height" as keyof BlockStateSuperset);
  if (state == undefined || typeof state !== "number") {
    return;
  } else if (state == 0) {
    return; // smallest
  }

  // Fire some particles
  event.dimension.spawnParticle("minecraft:crop_growth_area_emitter", event.block.location);
  // reset to 0
  event.block.setPermutation(event.block.permutation.withState("creatorcamp:height" as keyof BlockStateSuperset, 0));
}

system.beforeEvents.startup.subscribe((initEvent) => {
  initEvent.blockComponentRegistry.registerCustomComponent("creatorcamp:stomped", {
    onStepOn: stompOnBlock,
  });

  initEvent.blockComponentRegistry.registerCustomComponent("creatorcamp:grow", {
    onPlayerInteract: growBlock,
  });

  initEvent.itemComponentRegistry.registerCustomComponent(
    ThrowLeavesCustomComponent.COMPONENT_NAME,
    new ThrowLeavesCustomComponent()
  );

  initEvent.itemComponentRegistry.registerCustomComponent(
    LeafPileInteractionCustomComponent.COMPONENT_NAME,
    new LeafPileInteractionCustomComponent()
  );
});

function growBlock(event: BlockComponentPlayerInteractEvent) {
  const state = event.block.permutation.getState("creatorcamp:height" as keyof BlockStateSuperset);
  if (state == undefined || typeof state !== "number") {
    return;
  } else if (state == 2) {
    return; // largest
  }

  if (event.player) {
    const inventory = event.player.getComponent(EntityComponentTypes.Inventory);

    if (inventory?.container) {
      let itemInHand = inventory.container.getItem(event.player.selectedSlotIndex);
      if (itemInHand && itemInHand.typeId == MinecraftItemTypes.BoneMeal) {
        // Grow the Leaves with Bonemeal & spawn particles

        event.dimension.spawnParticle("minecraft:crop_growth_emitter", event.block.location);
        event.block.setPermutation(
          event.block.permutation.withState("creatorcamp:height" as keyof BlockStateSuperset, state + 1)
        );
        itemInHand.amount = itemInHand.amount - 1;
      }
    }
  }
}
