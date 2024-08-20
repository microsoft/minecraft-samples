// Copyright (c) Mojang AB.  All rights reserved.

import {
  ActionTypes,
  EditorInputContext,
  IPlayerUISession,
  IPropertyPane,
  InputModifier,
  KeyboardKey,
  PropertyBag,
  bindDataSource,
  registerEditorExtension,
} from "@minecraft/server-editor";

import DebugTools, { StaticDisplayToolIds } from "../DebugTools";
import { system } from "@minecraft/server";
import TimeOfDayInfoTool from "../tools/TimeOfDayInfoTool";

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
        this._session.toolRail.setSelectedToolId(tool.id);
      },
    });

    const tool = this._session.toolRail.addTool({
      title: "sample.debug_tools.tool.title",
      icon: "pack://textures/farm-generator.png",
      tooltip: "sample.debug_tools.tool.tooltip",
    });

    this._session.inputManager.registerKeyBinding(EditorInputContext.GlobalToolMode, toolToggleAction, {
      key: KeyboardKey.KEY_D,
      modifier: InputModifier.Control | InputModifier.Shift,
    });

    return tool;
  }

  createOuterPane() {
    const extensionPane = this._session.createPropertyPane({
      title: "sample.minimal.pane.title",
    });

    const buttonAction = this._session.actionManager.createAction({
      actionType: ActionTypes.NoArgsAction,
      onExecute: () => {
        const sh = new TimeOfDayInfoTool();

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
      this._outerPane?.removeSubPane(this._configurePane);
    }

    this._dataPane = undefined;
    this._configurePane = undefined;
  }

  addWatch() {
    if (this._measureToggleData) {
      const addTypeVal = this._measureToggleData["addType"];
      const addIdVal = this._measureToggleData["addId"];

      if (addTypeVal && addIdVal !== undefined && typeof addTypeVal === "number") {
        if (addTypeVal !== null && addTypeVal >= 0 && addTypeVal <= StaticDisplayToolIds.length - 1) {
          this._debugTools.ensureToolByTypeId(StaticDisplayToolIds[addTypeVal]);
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
      this._outerPane?.removeSubPane(this._configurePane);
      this._configurePane = undefined;
    }

    this._measureToggleData = {};

    for (const task of this._debugTools.tools) {
      this._measureToggleData[task.id] = this._debugTools.hasToolById(task.id);
    }

    this._measureToggleData["addType"] = 0;

    this._configurePane = windowPane.createSubPane({
      title: "debug_tools.toggle_measures",
    });

    this._boundToggleData = bindDataSource(this._configurePane, this._measureToggleData);

    this._configurePane.addDropdown(this._boundToggleData as any, {
      title: "sample.farmgenerator.pane.fence",
      enable: true,

      entries: [
        {
          label: "Scoreboard",
          value: 0,
        },
        {
          label: "Dyn Prop",
          value: 1,
        },
      ],
    });

    this._configurePane.addString(this._boundToggleData as any, {
      title: "sample.farmgenerator.pane.fence",
    });
    this._configurePane.addButton(
      this._session.actionManager.createAction({
        actionType: ActionTypes.NoArgsAction,
        onExecute: this.addWatch,
      }),
      {
        title: "sample.gotomark.pane.button.teleport",
        visible: true,
      }
    );

    for (let i = 0; i < StaticDisplayToolIds.length; i++) {
      const taskId: string = StaticDisplayToolIds[i];

      this._configurePane.addBool(this._boundToggleData, {
        title: "debug_tools." + taskId,
      });
    }

    this._dataPane = windowPane.createSubPane({
      title: "debug_tools.measurespane.title",
    });

    this._measureData = {};

    for (const task of this._debugTools.tools) {
      this._measureData[task.id] = task.getInfo();
    }

    this.updateDisplayData();

    this._boundData = bindDataSource(this._dataPane, this._measureData);

    for (const task of this._debugTools.tools) {
      this._dataPane.addString(this._boundData, task.id);
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
      this._outerPane?.removeSubPane(this._dataPane);
      this._dataPane = undefined;
    }

    this._dataPane = windowPane.createSubPane({
      title: "debug_tools.measurespane.title",
    });

    this._measureData = {};

    for (const task of this._debugTools.tools) {
      this._measureData[task.id] = task.getInfo();
    }

    this.updateDisplayData();

    this._boundData = bindDataSource(this._dataPane, this._measureData);

    for (const task of this._debugTools.tools) {
      this._dataPane.addString(this._boundData, task.id);
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
      for (const task of this._debugTools.tools) {
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

    const coreMenu = this._session.menuBar.createMenu({
      label: "sample.minimal.menu.title",
    });

    coreMenu.addItem(
      {
        label: "sample.minimal.menu.showpane",
      },

      this._session.actionManager.createAction({
        actionType: ActionTypes.NoArgsAction,
        onExecute: () => {
          this._outerPane?.show();
        },
      })
    );

    this.tick();

    return [];
  }

  tick() {
    this._sessionTick++;

    if (this._measureToggleData) {
      for (const strId in this._measureToggleData) {
        const val = this._measureToggleData[strId];

        if (val === false && this._debugTools.hasToolById(strId)) {
          this._debugTools.removeToolById(strId);
          this.ensureDataPane();
          this._outerPane?.show();
        } else if (val === true && !this._debugTools.hasToolById(strId)) {
          this._debugTools.createToolInstance(strId);
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
