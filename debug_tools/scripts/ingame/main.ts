import { ItemUseAfterEvent, Player, world } from "@minecraft/server";
import DebugTools, { StaticDisplayTaskIds as StaticInfoToolIds } from "../DebugTools";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

export const debugTools = new DebugTools();

debugTools.init();
debugTools.notifyDisplayDataUpdatedList.push(handleUpdate);

function afterItemUse(event: ItemUseAfterEvent) {
  if (!event.source || event.source.typeId !== "minecraft:player") {
    return;
  }

  if (event.itemStack.typeId === "debug_tools:magnifying_glass") {
    editSettings(event.source as Player);
  }
}

async function editSettings(player: Player) {
  const ad = new ActionFormData();

  if (!debugTools.displayInSubHeader) {
    ad.button("Turn on watch text");
  } else {
    ad.button("Turn off watch text");
  }

  ad.button("Edit watches");

  const mainAction = await ad.show(player);

  if (mainAction.canceled || mainAction.selection === undefined) {
    return;
  }

  if (mainAction.selection === 0) {
    debugTools.displayInSubHeader = !debugTools.displayInSubHeader;

    if (debugTools.displayInSubHeader === false) {
      clearHeader();
    } else if (debugTools.displayInSubHeader === true) {
      handleUpdate();
    }
  } else if (mainAction.selection === 1) {
    const measureList = new ActionFormData().title("Edit Tool Settings");

    for (let i = 0; i < StaticInfoToolIds.length; i++) {
      const taskId: string = StaticInfoToolIds[i];

      measureList.button(taskId);
    }

    const selectedMeasure = await measureList.show(player);

    if (!selectedMeasure.canceled && selectedMeasure.selection !== undefined) {
      showToolEditorDialog(player, selectedMeasure.selection);
    }
  }
}

async function showToolEditorDialog(player: Player, displayToolIndex: number) {
  const toolId = StaticInfoToolIds[displayToolIndex];
  const measureProps = new ModalFormData().title("Edit Tool Settings for " + toolId);

  measureProps.textField("Name", StaticInfoToolIds[displayToolIndex]);
  measureProps.toggle("Show this watch", debugTools.hasToolById(toolId));

  const data = await measureProps.show(player);

  if (data && !data.canceled && data.formValues) {
    if (data.formValues[1]) {
      debugTools.ensureToolByTypeId(toolId);
    } else {
      debugTools.removeToolById(toolId);
    }
  }
}

world.afterEvents.itemUse.subscribe(afterItemUse);

var hasSetTitle = false;
function clearHeader() {
  for (const player of world.getAllPlayers()) {
    player.onScreenDisplay.setTitle("");
  }
  hasSetTitle = false;
}

function handleUpdate() {
  let str = "";

  if (debugTools.displayInSubHeader) {
    for (const tool of debugTools.tools) {
      if (str.length > 0) {
        str += " ";
      }
      str += tool.getTitle() + ": " + tool.getInfo();
    }

    if (str.length > 0) {
      for (const player of world.getAllPlayers()) {
        if (!hasSetTitle) {
          player.onScreenDisplay.setTitle(" ", {
            subtitle: str,
            fadeInDuration: 0,
            fadeOutDuration: 0,
            stayDuration: 999,
          });
          hasSetTitle = true;
        } else {
          player.onScreenDisplay.updateSubtitle(str);
        }
      }
    }
  }
}
