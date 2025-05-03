import { world, Block, Direction, ItemStack, EntityComponentTypes, Player } from "@minecraft/server";

export namespace CommonUtils {
	export let DYNAMIC_PROPERTY_NAME: string = "leaf_count";
	export let MAX_LEAF_COUNT = 12;
	export let LORE_END_STRING: string = " / " + MAX_LEAF_COUNT + " Leaves";
	export let BLOCK_NAME: string = "creatorcamp:leaf_pile";
	export let BLOCK_HEIGHT_STATE_NAME = "creatorcamp:height";

	export function BlockFaceToLocation(face: Direction, block: Block): Block | undefined {
		switch (face) {
			case Direction.Down:
				return block.below();
			case Direction.Up:
				return block.above();
			case Direction.East:
				return block.east();
			case Direction.West:
				return block.west();
			case Direction.North:
				return block.north();
			case Direction.South:
				return block.south();
			default:
				return undefined;
		}
	}

	export function UpdateLeafCount(leafCount: number, itemStack: ItemStack | undefined, player: Player | undefined) {
		itemStack?.setDynamicProperty(CommonUtils.DYNAMIC_PROPERTY_NAME, leafCount);
		itemStack?.setLore([leafCount + CommonUtils.LORE_END_STRING]);
		player?.getComponent(EntityComponentTypes.Inventory)?.container?.setItem(player?.selectedSlotIndex, itemStack);
	}
}
