import {
	ItemCustomComponent,
	ItemComponentUseEvent,
	CustomComponentParameters,
	MolangVariableMap,
} from "@minecraft/server";
import { Vector3Utils } from "@minecraft/math";
import { CommonUtils } from "./CommonUtils";

type ThrowLeavesCustomComponentParams = {
	leaf_particle?: string;
};

export class ThrowLeavesCustomComponent implements ItemCustomComponent {
	static readonly COMPONENT_NAME: string = "ccid:shoot_leaves";

	onUse(e: ItemComponentUseEvent, p: CustomComponentParameters) {
		// If we're looking at a block, don't do any of the use behavior. We need to do this because onUse is also
		// called when onUseOn is called.
		const blockLookedAt = e.source.getBlockFromViewDirection({ maxDistance: 8 });
		if (blockLookedAt) {
			return;
		}

		const params = p.params as ThrowLeavesCustomComponentParams;
		let player = e.source;
		let itemStack = e.itemStack;
		const leafProperty = itemStack?.getDynamicProperty(CommonUtils.DYNAMIC_PROPERTY_NAME);
		// We want to default to 0, since the dynamic property could not be set yet.
		const leafCount = typeof leafProperty === "number" ? (leafProperty as number) : 0;

		// If the bag has leaves in it, spawn particles, decrement the leaf count, and update the data.
		if (leafCount > 0 && params.leaf_particle) {
			const particleLoc = Vector3Utils.add(
				Vector3Utils.normalize(player.getViewDirection()),
				player.getHeadLocation()
			);

			const colorMap = new MolangVariableMap();
			colorMap.setColorRGB("color", { red: 97 / 255, green: 171 / 255, blue: 61 / 255 });

			player.dimension.spawnParticle(params.leaf_particle, particleLoc, colorMap);
			CommonUtils.UpdateLeafCount(leafCount - 1, itemStack, player);
		}
		// If there are no leaves, inform the player and set the data to 0, since this could be the first use.
		else if (leafCount == 0) {
			player.onScreenDisplay.setActionBar("Bag o' Leaves is empty!");
			CommonUtils.UpdateLeafCount(leafCount, itemStack, player);
		}
	}
}
