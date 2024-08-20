import { ItemUseAfterEvent, Player, world } from "@minecraft/server";
import DebugTools, { DynamicToolIds, DynamicToolTitles, StaticToolIds } from "../DebugTools";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import ITool from "../ITool";

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
    const toolList = new ActionFormData().title("Edit Tool Settings");

    for (let i = 0; i < StaticToolIds.length; i++) {
      const taskId: string = StaticToolIds[i];

      toolList.button(taskId);
    }

    for (let i = 0; i < debugTools.tools.length; i++) {
      const tool = debugTools.tools[i];

      if (!StaticToolIds.includes(tool.id)) {
        toolList.button(tool.getTitle());
      }
    }

    toolList.button("Add watch");

    const selectedTool = await toolList.show(player);

    if (
      !selectedTool.canceled &&
      selectedTool.selection !== undefined &&
      selectedTool.selection < StaticToolIds.length
    ) {
      showToolEditorDialog(player, selectedTool.selection);
    } else if (!selectedTool.canceled && selectedTool.selection === StaticToolIds.length) {
      showAddToolDialog(player);
    }
  }
}

async function showToolEditorDialog(player: Player, displayToolIndex: number) {
  const toolId = StaticToolIds[displayToolIndex];
  const toolProps = new ModalFormData().title("Edit Tool Settings for " + toolId);

  toolProps.toggle("Show this watch", debugTools.hasToolById(toolId));

  const data = await toolProps.show(player);

  if (data && !data.canceled && data.formValues) {
    if (data.formValues[0]) {
      debugTools.ensureToolByTypeId(toolId);
    } else {
      debugTools.removeToolById(toolId);
    }
  }
}

async function showAddToolDialog(player: Player) {
  const measureProps = new ActionFormData().title("Add Tool");

  for (const toolId of DynamicToolTitles) {
    measureProps.button("New " + toolId + " watch");
  }

  const data = await measureProps.show(player);

  if (data && !data.canceled && data.selection !== undefined) {
    let newToolId = DynamicToolIds[data.selection];

    const tool = debugTools.addTool(newToolId);

    if (tool) {
      showToolEditor(player, tool);
    }
  }
}

function showToolEditor(player: Player, tool: ITool) {
  switch (tool.typeId.toLowerCase()) {
    case "dynamicproperty":
      showDynamicPropertyDialog(player, tool);
      break;
    case "scoreboard":
      showScoreboardDialog(player, tool);
      break;
  }
}

async function showDynamicPropertyDialog(player: Player, tool: ITool) {
  const toolProps = new ModalFormData().title("Edit " + tool.id + " Settings");

  toolProps.toggle("Remove this watch", false);

  const data = await toolProps.show(player);

  if (data && !data.canceled && data.formValues) {
    if (data.formValues[0]) {
      debugTools.removeToolById(tool.id);
    }
  }
}

async function showScoreboardDialog(player: Player, tool: ITool) {
  const toolProps = new ModalFormData().title("Edit " + tool.id + " Settings");

  toolProps.toggle("Remove this watch", false);
  toolProps.textField("Scoreboard value", tool.data);

  const data = await toolProps.show(player);

  if (data && !data.canceled && data.formValues) {
    if (data.formValues[0]) {
      debugTools.removeToolById(tool.id);
    }

    tool.data = data.formValues[1] as string;

    debugTools.save();
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
