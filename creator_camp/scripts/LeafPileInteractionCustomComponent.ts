import {
  ItemCustomComponent,
  ItemComponentUseOnEvent,
  Player,
  BlockPermutation,
  Direction,
  world,
} from "@minecraft/server";
import { BlockStateSuperset, MinecraftBlockTypes } from "@minecraft/vanilla-data";
import { CommonUtils } from "./CommonUtils";

export class LeafPileInteractionCustomComponent implements ItemCustomComponent {
  static readonly COMPONENT_NAME: string = "ccid:leaf_pile_interaction";

  onUseOn(e: ItemComponentUseOnEvent) {
    world.sendMessage("ItemUseOn event fired!");
    const block = e.block;
    const face = e.blockFace;
    const blockPerm = e.usedOnBlockPermutation;
    let itemStack = e.itemStack;
    let player = e.source instanceof Player ? (e.source as Player) : undefined;
    const leafProperty = itemStack?.getDynamicProperty(CommonUtils.DYNAMIC_PROPERTY_NAME);
    // We want to default to 0, since the dynamic property could not be set yet.
    const leafCount = typeof leafProperty === "number" ? (leafProperty as number) : 0;

    // If the block we interact with is a Leaf Pile, try to pick it up.
    const state = blockPerm.getState(CommonUtils.BLOCK_HEIGHT_STATE_NAME as keyof BlockStateSuperset);
    world.sendMessage(`Leaf Pile state: ${state}`);
    if (block.matches(CommonUtils.BLOCK_NAME) && state !== undefined && typeof state === "number") {
      if (leafCount >= CommonUtils.MAX_LEAF_COUNT) {
        player?.onScreenDisplay.setActionBar("Bag o' Leaves is full!");
      } else {
        // The "creatorcamp:height" state is 0 indexed, so we need to add 1 to get the actual leaf count.
        const leafSum = leafCount + state + 1;
        const leavesLeft = leafSum > CommonUtils.MAX_LEAF_COUNT ? leafSum % CommonUtils.MAX_LEAF_COUNT : 0;

        // If leavesLeft is 0, then we know we can fit all the leaves into the bag and get rid of the Leaf Pile block.
        if (leavesLeft == 0) {
          block.setType(MinecraftBlockTypes.Air);
        }
        // Otherwise, just reduce the size of the Leaf Pile (subtracting the 1 we added), and notify the player if possible.
        else {
          block.setPermutation(
            blockPerm.withState(CommonUtils.BLOCK_HEIGHT_STATE_NAME as keyof BlockStateSuperset, leavesLeft - 1)
          );
          player?.onScreenDisplay.setActionBar("Bag o' Leaves is full!");
        }

        // Now add the leaves to the bag and update the data.
        CommonUtils.UpdateLeafCount(leafCount + state + 1 - leavesLeft, itemStack, player);
      }
    }
    // Otherwise, try to place a new Leaf Pile if we have any.
    else {
      if (leafCount > 0) {
        const newBlockPerm = BlockPermutation.resolve(CommonUtils.BLOCK_NAME);
        const newBlockPos = CommonUtils.BlockFaceToLocation(face, block);

        if (newBlockPos && face == Direction.Up) {
          e.source.dimension.setBlockPermutation(newBlockPos, newBlockPerm);
          CommonUtils.UpdateLeafCount(leafCount - 1, itemStack, player);
        }
      } else {
        player?.onScreenDisplay.setActionBar("Bag o' Leaves is empty!");
        CommonUtils.UpdateLeafCount(leafCount, itemStack, player);
      }
    }
  }
}
