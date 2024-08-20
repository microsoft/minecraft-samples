import { ItemUseAfterEvent, Player, world } from "@minecraft/server";
import DebugTools, { StaticDisplayToolIds } from "../DebugTools";
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

    for (let i = 0; i < StaticDisplayToolIds.length; i++) {
      const taskId: string = StaticDisplayToolIds[i];

      measureList.button(taskId);
    }

    measureList.button("Add Watch");

    const selectedMeasure = await measureList.show(player);

    if (
      !selectedMeasure.canceled &&
      selectedMeasure.selection !== undefined &&
      selectedMeasure.selection < StaticDisplayToolIds.length
    ) {
      showToolEditorDialog(player, selectedMeasure.selection);
    } else if (!selectedMeasure.canceled && selectedMeasure.selection === StaticDisplayToolIds.length) {
      showAddToolDialog(player, selectedMeasure.selection);
    }
  }
}

async function showToolEditorDialog(player: Player, displayToolIndex: number) {
  const toolId = StaticDisplayToolIds[displayToolIndex];
  const measureProps = new ModalFormData().title("Edit Tool Settings for " + toolId);

  measureProps.textField("Name", StaticDisplayToolIds[displayToolIndex]);
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

async function showAddToolDialog(player: Player, displayToolIndex: number) {
  const toolId = StaticDisplayToolIds[displayToolIndex];
  const measureProps = new ActionFormData().title("Add Tool");

  measureProps.button("New Dynamic Property Watch");
  measureProps.button("New Command Result Watch");
  measureProps.button("New Scoreboard Watch");
  measureProps.button("New Location Watch");

  const data = await measureProps.show(player);

  if (data && !data.canceled && data.selection) {
    let newToolId = "";

    switch (data.selection) {
      case 0:
        newToolId = "dynamicProperty";
        break;
      case 1:
        newToolId = "commandResult";
        break;
      case 2:
        newToolId = "scoreboard";
        break;
      case 3:
        newToolId = "location";
        break;
    }

    if (newToolId.length > 0) {
      debugTools.addTool(newToolId);
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
