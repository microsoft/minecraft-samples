
import { world, BlockCustomComponent, BlockComponentStepOnEvent, BlockPermutation, BlockComponentPlayerInteractEvent, ItemStack } from '@minecraft/server';
import { MinecraftItemTypes } from "@minecraft/vanilla-data";

export default class LuckyblockActions implements BlockCustomComponent {
  constructor() {
    this.onStepOn = this.onStepOn.bind(this);
    this.onPlayerInteract = this.onPlayerInteract.bind(this);
  }

  items = [MinecraftItemTypes.GoldBlock, MinecraftItemTypes.DiamondLeggings, MinecraftItemTypes.IronSword, MinecraftItemTypes.GoldenApple];

  onPlayerInteract(e: BlockComponentPlayerInteractEvent) {
    world.playSound("wood_sprung", e.block.location);

    if (e.block.permutation.getState("mike_luck:unlucky") === true && Math.random() < 0.5) {
      world.sendMessage("Unlucky!!");
      e.dimension.createExplosion(e.block.location, 10, { breaksBlocks: false });
    }
    else {
      world.sendMessage("Lucky!!");

      let item = this.items[Math.floor(Math.random() * this.items.length)];

      e.dimension.spawnItem(new ItemStack(item, 1), e.block.location);
    }
  }

  onStepOn(e: BlockComponentStepOnEvent): void {
    e.block.setPermutation(BlockPermutation.resolve('minecraft:air'));
  }
}

export function initLuckyblockActions() {
  world.beforeEvents.worldInitialize.subscribe(initEvent => {
    initEvent.blockComponentRegistry.registerCustomComponent('mike_luck:luckyblock_actions', new LuckyblockActions());
  });
}
