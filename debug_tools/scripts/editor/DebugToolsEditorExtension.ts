// Copyright (c) Mojang AB.  All rights reserved.

import {
  ActionTypes,
  CoreMenuType,
  EditorInputContext,
  IMenu,
  IPlayerUISession,
  IPropertyPane,
  InputModifier,
  KeyboardKey,
  PropertyBag,
  bindDataSource,
  registerEditorExtension,
} from "@minecraft/server-editor";

import TimeOfDay from "../tools/TimeOfDay";
import DebugTools, { AvailableDisplayTaskIds } from "../DebugTools";
import { system } from "@minecraft/server";

export default class DebugToolsEditorExtension {
  private _debugTools: DebugTools;
  private _sessionTick = 0;
  private _outerPane: IPropertyPane | undefined;
  private _dataPane: IPropertyPane | undefined;
  private _configurePane: IPropertyPane | undefined;

  private _measureData: PropertyBag | undefined;
  private _boundData: PropertyBag | undefined;
  private _measureToggleData: PropertyBag | undefined;
  private _boundToggleData: PropertyBag | undefined;
  private _session: IPlayerUISession;

  get session() {
    return this._session;
  }

  constructor(debugTools: DebugTools, session: IPlayerUISession) {
    this._debugTools = debugTools;
    this._session = session;

    this.init = this.init.bind(this);
    this.addWatch = this.addWatch.bind(this);
    this.tick = this.tick.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.updateDisplayData = this.updateDisplayData.bind(this);
  }

  addTool() {
    const toolToggleAction = this._session.actionManager.createAction({
      actionType: ActionTypes.NoArgsAction,
      onExecute: () => {
        this._session.toolRail.setSelectedOptionId(tool.id, true);
      },
    });

    const tool = this._session.toolRail.addTool(
      {
        displayStringId: "sample.debug_tools.tool.title",
        displayAltText: "Debug Tools (CTRL + SHIFT + D)",
        icon: "pack://textures/farm-generator.png",
        tooltipStringId: "sample.debug_tools.tool.tooltip",
        tooltipAltText: "Quickly create a custom farm",
      },
      toolToggleAction
    );

    this._session.inputManager.registerKeyBinding(
      EditorInputContext.GlobalToolMode,
      toolToggleAction,
      KeyboardKey.KEY_D,
      InputModifier.Control | InputModifier.Shift
    );

    return tool;
  }

  createOuterPane() {
    const extensionPane = this._session.createPropertyPane({
      titleStringId: "sample.minimal.pane.title",
      titleAltText: "Debug Tools",
    });

    const buttonAction = this._session.actionManager.createAction({
      actionType: ActionTypes.NoArgsAction,
      onExecute: () => {
        const sh = new TimeOfDay();

        sh.run();
      },
    });

    this._outerPane = extensionPane;

    this.ensurePanes();
  }

  ensurePanes(): void {
    this.ensureConfigurePane();
    this.ensureDataPane();

    this._outerPane?.show();
  }

  deactivatePane(): void {
    if (this._configurePane) {
      this._outerPane?.removePropertyPane(this._configurePane);
    }

    this._dataPane = undefined;
    this._configurePane = undefined;
  }

  addWatch() {
    if (this._measureToggleData) {
      const addTypeVal = this._measureToggleData["addType"];
      const addIdVal = this._measureToggleData["addId"];

      if (addTypeVal !== undefined && addIdVal !== undefined) {
        if (addTypeVal === 0) {
          this._debugTools.addDisplayTaskId("s|" + addIdVal);
        } else if (addTypeVal === 1) {
          this._debugTools.addDisplayTaskId("w|" + addIdVal);
        }
        this.ensureDataPane();
        this._outerPane?.show();
      }
    }
  }

  ensureConfigurePane() {
    const windowPane = this._outerPane;

    if (!windowPane) {
      this._session.log.error("Failed to find window binding");
      return undefined;
    }

    if (this._configurePane) {
      this._outerPane?.removePropertyPane(this._configurePane);
      this._configurePane = undefined;
    }

    this._measureToggleData = {};

    for (const task of this._debugTools.tools) {
      this._measureToggleData[task.id] = this._debugTools.hasToolById(task.id);
    }

    this._measureToggleData["addType"] = 0;

    this._configurePane = windowPane.createPropertyPane({
      titleStringId: "debug_tools.toggle_measures",
      titleAltText: "Configure",
    });

    this._boundToggleData = bindDataSource(this._configurePane, this._measureToggleData);

    this._configurePane.addDropdown(this._boundToggleData as any, "addType", {
      titleStringId: "sample.farmgenerator.pane.fence",
      titleAltText: "Type",
      enable: true,
      dropdownItems: [
        {
          displayAltText: "Scoreboard",
          displayStringId: "Scoreboard",
          value: 0,
        },
        {
          displayAltText: "Dyn Prop",
          displayStringId: "Dyn Prop",
          value: 1,
        },
      ],
    });

    this._configurePane.addString(this._boundToggleData as any, "addId", {
      titleStringId: "sample.farmgenerator.pane.fence",
      titleAltText: "Name",
    });
    this._configurePane.addButton(
      this._session.actionManager.createAction({
        actionType: ActionTypes.NoArgsAction,
        onExecute: this.addWatch,
      }),
      {
        titleStringId: "sample.gotomark.pane.button.teleport",
        titleAltText: "Add Watch",
        visible: true,
      }
    );

    for (let i = 0; i < AvailableDisplayTaskIds.length; i++) {
      const taskId: string = AvailableDisplayTaskIds[i];

      this._configurePane.addBool(this._boundToggleData, taskId, {
        titleStringId: "debug_tools." + taskId,
        titleAltText: taskId,
      });
    }

    this._dataPane = windowPane.createPropertyPane({
      titleStringId: "debug_tools.measurespane.title",
      titleAltText: "Measures",
    });

    this._measureData = {};

    for (const task of this._debugTools.displayTasks) {
      this._measureData[task.id] = task.getInfo();
    }

    this.updateDisplayData();

    this._boundData = bindDataSource(this._dataPane, this._measureData);

    for (const task of this._debugTools.displayTasks) {
      this._dataPane.addText(this._boundData, task.id, { border: false, valueStringId: "test" });
    }

    this._configurePane?.show();
  }

  ensureDataPane() {
    const windowPane = this._outerPane;

    if (!windowPane) {
      this._session.log.error("Failed to find window binding");
      return undefined;
    }

    if (this._dataPane) {
      this._outerPane?.removePropertyPane(this._dataPane);
      this._dataPane = undefined;
    }

    this._dataPane = windowPane.createPropertyPane({
      titleStringId: "debug_tools.measurespane.title",
      titleAltText: "Measures",
    });

    this._measureData = {};

    for (const task of this._debugTools.displayTasks) {
      this._measureData[task.id] = task.getInfo();
    }

    this.updateDisplayData();

    this._boundData = bindDataSource(this._dataPane, this._measureData);

    for (const task of this._debugTools.displayTasks) {
      this._dataPane.addText(this._boundData, task.id, { border: false, valueStringId: "test" });
    }

    this._dataPane?.show();
  }

  public log(message: string) {
    if (this._session) {
      this._session.log.debug(message);
    }
  }

  public updateDisplayData() {
    if (this._boundData) {
      for (const task of this._debugTools.displayTasks) {
        this._boundData[task.id] = task.getTitle() + ": " + task.getInfo();
      }
    }
  }

  public init() {
    this.log(
      `Initializing extension [${this._session.extensionContext.extensionInfo.name}] for player [${this._session.extensionContext.player.name}]`
    );

    this._debugTools.notifyDisplayDataUpdatedList.push(this.updateDisplayData);

    this.createOuterPane();

    if (!this._outerPane) {
      this.log("Unexpectedly could not create a pane.");
      return [];
    }

    const tool = this.addTool();
    tool.bindPropertyPane(this._outerPane);

    this._session.menuBar
      .getMenu(CoreMenuType.Extensions)
      .then((coreMenu: IMenu) => {
        const extensionMenu = coreMenu.addItem({
          displayStringId: "sample.minimal.menu.title",
          name: "Debug Tools",
        });

        extensionMenu.addItem(
          {
            displayStringId: "sample.minimal.menu.showpane",
            name: "Show Pane",
          },

          this._session.actionManager.createAction({
            actionType: ActionTypes.NoArgsAction,
            onExecute: () => {
              this._outerPane?.show();
            },
          })
        );
      })
      .catch((error: Error) => {
        this._session.log.error(error.message);
      });

    this.tick();

    return [];
  }

  tick() {
    this._sessionTick++;

    if (this._measureToggleData) {
      for (const strId in this._measureToggleData) {
        const val = this._measureToggleData[strId];

        if (val === false && this._debugTools.data.displayTaskIds.includes(strId)) {
          this._debugTools.removeDisplayTaskId(strId);
          this.ensureDataPane();
          this._outerPane?.show();
        } else if (val === true && !this._debugTools.data.displayTaskIds.includes(strId)) {
          this._debugTools.addDisplayTaskId(strId);
          this.ensureDataPane();
          this._outerPane?.show();
        }
      }
    }

    system.run(this.tick);
  }

  shutdown(uiSession: IPlayerUISession) {
    this._session = uiSession;

    this.log(
      `Shutting down extension [${uiSession.extensionContext.extensionInfo.name}] for player [${uiSession.extensionContext.player.name}]`
    );
  }
}

export var playerEditorExtensions: DebugToolsEditorExtension[] = [];

export function registerExtension(debugTools: DebugTools) {
  registerEditorExtension(
    "debug-tools",
    (uiSession: IPlayerUISession) => {
      const editorExtension = new DebugToolsEditorExtension(debugTools, uiSession);

      playerEditorExtensions.push(editorExtension);

      return editorExtension.init();
    },
    (uiSession: IPlayerUISession) => {
      for (const extension of playerEditorExtensions) {
        if (extension.session === uiSession) {
          extension.shutdown(uiSession);
        }
      }
    },
    {
      description: "Debug Tools",
    }
  );
}
