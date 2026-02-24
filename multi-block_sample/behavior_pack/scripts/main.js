import { system } from "@minecraft/server";

class LightPostComponent {
    static componentName = "multi_block:light_post_component";

    constructor() {
        this.onRedstoneUpdate = this.onRedstoneUpdate.bind(this);
    }
    checkStateIsGood(state) {
        if (state === undefined) {
            return false; // no state
        }
        else if (typeof state !== 'boolean') {
            return false; // bad state
        }
        return true;
    }

    setLight(block, powerLevel) {
        const perm = block.permutation;
        const lightOnState = perm.getState('multi_block:light_on');
        if (this.checkStateIsGood(lightOnState)) {
            if(powerLevel > 0) {
                block.setPermutation(perm.withState('multi_block:light_on', true));
            }
            else {
                block.setPermutation(perm.withState('multi_block:light_on', false));
            }
        }
    }

    onRedstoneUpdate(event) {
        const parts = event.block.getParts();
        if (parts === undefined) {
            return; //not a multi block
        }
        
        parts.forEach((part) => {
            this.setLight(part, event.powerLevel)
        });
    }
}

system.beforeEvents.startup.subscribe((initEvent) => {
    initEvent.blockComponentRegistry.registerCustomComponent(LightPostComponent.componentName, new LightPostComponent());
});