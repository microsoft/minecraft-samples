import { ItemUseAfterEvent, Player, world } from "@minecraft/server";
import DebugTools, { AvailableDisplayTaskIds } from "../DebugTools";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

export const debugTools = new DebugTools();

debugTools.init();
debugTools.notifyDisplayDataUpdatedList.push(handleUpdate);

function afterItemUse(event: ItemUseAfterEvent) {
  if (!event.source || event.source.typeId !== "minecraft:player") {
    return;
  }

  if (event.itemStack.typeId === "demo:wrench") {
    editSettings(event.source as Player);
  }
}

async function editSettings(player: Player) {
  const mfd = new ModalFormData().title("Edit Debug Tools Settings");

  const previousDisplayInSubHeader = debugTools.displayInSubHeader;
  mfd.toggle("Show in sub-header", debugTools.displayInSubHeader);

  for (let i = 0; i < AvailableDisplayTaskIds.length; i++) {
    const taskId: string = AvailableDisplayTaskIds[i];

    mfd.toggle(taskId, debugTools.data.displayTaskIds.includes(taskId));
  }

  const result = await mfd.show(player);

  if (!result.canceled && result.formValues) {
    if (typeof result.formValues[0] === "boolean") {
      debugTools.displayInSubHeader = result.formValues[0];

      if (debugTools.displayInSubHeader === false && previousDisplayInSubHeader === true) {
        clearHeader();
      } else if (debugTools.displayInSubHeader === true && previousDisplayInSubHeader === false) {
        handleUpdate();
      }
    }

    for (let i = 0; i < AvailableDisplayTaskIds.length; i++) {
      const val = result.formValues[i + 1];
      const strId = AvailableDisplayTaskIds[i];

      if (val === false && debugTools.data.displayTaskIds.includes(strId)) {
        debugTools.removeDisplayTaskId(strId);
      } else if (val === true && !debugTools.data.displayTaskIds.includes(strId)) {
        debugTools.addDisplayTaskId(strId);
      }
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
    for (const task of debugTools.displayTasks) {
      if (str.length > 0) {
        str += " ";
      }
      str += task.getTitle() + ": " + task.getInfo();
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
