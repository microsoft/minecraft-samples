import { DisplaySlotId, ItemUseAfterEvent, Player, system, world } from "@minecraft/server";
import DebugTools, { DynamicToolIds, DynamicToolTitles, StaticToolIds } from "../DebugTools";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import ITool, { IToolConfigurationExperience } from "../ITool";
import Utilities from "../Utilities";

export const debugTools = new DebugTools();

let lastConsoleWarningTick = -1;
let lastMessageWarningTick = -1;

const MESSAGE_INTERVAL = 100;

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
    ad.button("Turn on watch subheader text");
  } else {
    ad.button("Turn off watch subheader text");
  }

  if (!debugTools.displayScoreboard) {
    ad.button("Turn on watch scoreboard text");
  } else {
    ad.button("Turn off watch scoreboard text");
  }

  if (!debugTools.displayIngameMessage) {
    ad.button("Turn on watch ingame message");
  } else {
    ad.button("Turn off watch ingame message");
  }

  if (!debugTools.displayConsoleWarning) {
    ad.button("Turn on console warning message");
  } else {
    ad.button("Turn off console warning message");
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
    debugTools.displayScoreboard = !debugTools.displayScoreboard;

    if (debugTools.displayScoreboard === false) {
      clearHeader();
    } else if (debugTools.displayScoreboard === true) {
      handleUpdate();
    }
  } else if (mainAction.selection === 2) {
    debugTools.displayIngameMessage = !debugTools.displayIngameMessage;
    if (debugTools.displayIngameMessage === true) {
      handleUpdate();
    }
  } else if (mainAction.selection === 3) {
    debugTools.displayConsoleWarning = !debugTools.displayConsoleWarning;

    if (debugTools.displayConsoleWarning === true) {
      handleUpdate();
    }
  } else if (mainAction.selection === 4) {
    const toolList = new ActionFormData().title("Edit Tool Settings");
    const dynTools: ITool[] = [];

    for (let i = 0; i < StaticToolIds.length; i++) {
      const taskId: string = StaticToolIds[i];

      toolList.button(taskId);
    }

    for (let i = 0; i < debugTools.tools.length; i++) {
      const tool = debugTools.tools[i];

      if (!StaticToolIds.includes(tool.id)) {
        dynTools.push(tool);
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
      showStaticToolEditorDialog(player, selectedTool.selection);
    } else if (
      !selectedTool.canceled &&
      selectedTool.selection !== undefined &&
      selectedTool.selection >= StaticToolIds.length &&
      selectedTool.selection < StaticToolIds.length + dynTools.length
    ) {
      showToolEditor(player, dynTools[selectedTool.selection - StaticToolIds.length]);
    } else if (
      !selectedTool.canceled &&
      selectedTool.selection !== undefined &&
      selectedTool.selection >= StaticToolIds.length + dynTools.length
    ) {
      showAddToolDialog(player);
    }
  }
}

async function showStaticToolEditorDialog(player: Player, toolIndex: number) {
  const toolId = StaticToolIds[toolIndex];
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
  if (tool.configurationExperience === IToolConfigurationExperience.noData) {
    showNoDataPropertyDialog(player, tool);
  } else if (tool.configurationExperience === IToolConfigurationExperience.dataAsString) {
    showDataStringDialog(player, tool);
  } else if (tool.configurationExperience === IToolConfigurationExperience.dataAsLocation) {
    showDataLocationDialog(player, tool);
  }
}

async function showNoDataPropertyDialog(player: Player, tool: ITool) {
  const toolProps = new ModalFormData().title("Edit " + tool.id + " Settings");

  toolProps.toggle("Remove this watch", false);

  const data = await toolProps.show(player);

  if (data && !data.canceled && data.formValues) {
    if (data.formValues[0]) {
      debugTools.removeToolById(tool.id);
    }
  }
}

async function showDataStringDialog(player: Player, tool: ITool) {
  const toolProps = new ModalFormData().title("Edit " + tool.id + " Settings");

  toolProps.toggle("Remove this watch", false);

  let description = "Value";

  if (tool.getConfigurationDataPropertyTitle) {
    description = tool.getConfigurationDataPropertyTitle();
  }

  toolProps.textField(description, tool.data);

  const data = await toolProps.show(player);

  if (data && !data.canceled && data.formValues) {
    if (data.formValues[0]) {
      debugTools.removeToolById(tool.id);
    }

    tool.data = data.formValues[1] as string;

    debugTools.save();
  }
}

async function showDataLocationDialog(player: Player, tool: ITool) {
  const toolProps = new ModalFormData().title("Edit " + tool.id + " Settings");

  toolProps.toggle("Remove this watch", false);

  const loc = Utilities.getLocationFromString(tool.data, player.location);

  toolProps.textField("X", loc.x.toString());
  toolProps.textField("Y", loc.y.toString());
  toolProps.textField("Z", loc.z.toString());

  const data = await toolProps.show(player);

  if (data && !data.canceled && data.formValues) {
    const loc2 = Utilities.getLocationFromCoordStrings(
      data.formValues[1] as string,
      data.formValues[2] as string,
      data.formValues[3] as string,
      loc
    );

    tool.data = loc2.x + "," + loc2.y + "," + loc2.z;

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
  let singleLineUpdate = "";
  let curTick = system.currentTick;

  for (const tool of debugTools.tools) {
    if (singleLineUpdate.length > 0) {
      singleLineUpdate += " ";
    }
    singleLineUpdate += tool.getTitle() + ": " + tool.getInfo();
  }

  if (debugTools.displayConsoleWarning && curTick > lastConsoleWarningTick + MESSAGE_INTERVAL) {
    console.warn(singleLineUpdate);

    lastConsoleWarningTick = curTick;
  }

  if (debugTools.displayIngameMessage && curTick > lastMessageWarningTick + MESSAGE_INTERVAL) {
    world.sendMessage(singleLineUpdate);

    lastMessageWarningTick = curTick;
  }

  if (debugTools.displayScoreboard) {
    for (const obj of world.scoreboard.getObjectives()) {
      world.scoreboard.removeObjective(obj.id);
    }

    for (const tool of debugTools.tools) {
      if (tool.id) {
        let obj = world.scoreboard.getObjective("sbd_" + tool.id);
        if (!obj) {
          obj = world.scoreboard.addObjective("sbd_" + tool.id, tool.getTitle() + ": " + tool.getInfo());
        }
        world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, {
          objective: obj,
        });
      }
    }
  }

  if (debugTools.displayInSubHeader) {
    if (singleLineUpdate.length > 0) {
      for (const player of world.getAllPlayers()) {
        if (!hasSetTitle) {
          player.onScreenDisplay.setTitle(" ", {
            subtitle: singleLineUpdate,
            fadeInDuration: 0,
            fadeOutDuration: 0,
            stayDuration: 999,
          });
          hasSetTitle = true;
        } else {
          player.onScreenDisplay.updateSubtitle(singleLineUpdate);
        }
      }
    }
  }
}
