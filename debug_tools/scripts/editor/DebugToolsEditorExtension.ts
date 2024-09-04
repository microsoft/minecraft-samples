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
  makeObservable,
  registerEditorExtension,
} from "@minecraft/server-editor";

import DebugTools from "../DebugTools";
import DebugToolRegistry, { StaticToolIds } from "../DebugToolRegistry";
import { system } from "@minecraft/server";
import TimeOfDayWatchTool from "../tools/TimeOfDayWatchTool";

export default class DebugToolsEditorExtension {
  private _debugTools: DebugTools;
  private _sessionTick = 0;
  private _watchOuterPane: IPropertyPane | undefined;
  private _dataPane: IPropertyPane | undefined;
  private _configurePane: IPropertyPane | undefined;

  private _measureData: PropertyBag | undefined;
  private _boundData: any = {};
  private _watchToggleData: { [name: string]: boolean } = {};
  private _boundWatchToggleData: any = {};

  private _addWatchData: { type: string; data: string } = { type: "scoreboard", data: "" };
  private _boundAddWatchData: any = {};

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
      title: "Debug Tools",
      icon: "pack://textures/farm-generator.png",
      tooltip: "Debug Tools",
    });

    this._session.inputManager.registerKeyBinding(EditorInputContext.GlobalToolMode, toolToggleAction, {
      key: KeyboardKey.KEY_D,
      modifier: InputModifier.Control | InputModifier.Shift,
    });

    return tool;
  }

  createOuterPane() {
    const watchPane = this._session.createPropertyPane({
      title: "Watches",
    });

    const buttonAction = this._session.actionManager.createAction({
      actionType: ActionTypes.NoArgsAction,
      onExecute: () => {
        const sh = new TimeOfDayWatchTool();

        sh.run();
      },
    });

    this._watchOuterPane = watchPane;

    this.ensurePanes();
  }

  ensurePanes(): void {
    this.ensureConfigurePane();
    this.ensureDataPane();

    this._watchOuterPane?.show();
  }

  deactivatePane(): void {
    if (this._configurePane) {
      this._watchOuterPane?.removeSubPane(this._configurePane);
    }

    this._dataPane = undefined;
    this._configurePane = undefined;
  }

  addWatch() {
    if (this._boundAddWatchData) {
      const addTypeVal = this._boundAddWatchData["type"].value;
      const addDataVal = this._boundAddWatchData["data"].value;

      if (addTypeVal && addDataVal !== undefined && typeof addTypeVal === "string") {
        this._debugTools.addTool(addTypeVal);

        this.ensureDataPane();
        this._watchOuterPane?.show();
      }
    }
  }

  updateStatics() {
    if (this._boundWatchToggleData) {
      for (let i = 0; i < StaticToolIds.length; i++) {
        const toolId: string = StaticToolIds[i];

        if (this._boundWatchToggleData[toolId]) {
          if (this._boundWatchToggleData[toolId].value) {
            this._debugTools.ensureToolByTypeId(toolId);
          } else if (!this._boundWatchToggleData[toolId].value) {
            this._debugTools.removeToolById(toolId);
          }
        }
      }

      this.ensureDataPane();
    }
  }

  ensureConfigurePane() {
    const windowPane = this._watchOuterPane;

    if (!windowPane) {
      this._session.log.error("Failed to find window binding");
      return undefined;
    }

    if (this._configurePane) {
      this._watchOuterPane?.removeSubPane(this._configurePane);
      this._configurePane = undefined;
    }

    this._watchToggleData = {};

    for (const tool of this._debugTools.tools) {
      this._watchToggleData[tool.id] = this._debugTools.hasToolById(tool.id);
    }

    this._addWatchData.type = "scoreboard";
    this._addWatchData.data = "";

    this._configurePane = windowPane.createSubPane({
      title: "Configure Watches",
    });

    this._boundAddWatchData["type"] = makeObservable(this._addWatchData.type);
    this._boundAddWatchData["data"] = makeObservable(this._addWatchData.data);

    this._configurePane.addDropdown(this._boundAddWatchData["type"], {
      title: "Type",
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

    this._configurePane.addString(this._boundAddWatchData["data"], {
      title: "Data",
    });

    this._configurePane.addButton(
      this._session.actionManager.createAction({
        actionType: ActionTypes.NoArgsAction,
        onExecute: this.addWatch,
      }),
      {
        title: "Add Watch",
        visible: true,
      }
    );

    for (let i = 0; i < StaticToolIds.length; i++) {
      const toolId: string = StaticToolIds[i];

      if (!this._boundWatchToggleData[toolId]) {
        this._boundWatchToggleData[toolId] = makeObservable(this._watchToggleData[toolId]);
      }

      this._configurePane.addBool(this._boundWatchToggleData[toolId], {
        title: toolId,
      });
    }

    this._configurePane.addButton(
      this._session.actionManager.createAction({
        actionType: ActionTypes.NoArgsAction,
        onExecute: this.updateStatics,
      }),
      {
        title: "Update",
        visible: true,
      }
    );

    this.updateDisplayData();

    this._configurePane?.show();
  }

  ensureDataPane() {
    if (!this._watchOuterPane) {
      this._session.log.error("Failed to find window binding");
      return undefined;
    }

    if (this._dataPane) {
      this._watchOuterPane.removeSubPane(this._dataPane);
      this._dataPane = undefined;
    }

    this._dataPane = this._watchOuterPane.createSubPane({
      title: "Watch values",
    });

    this._measureData = {};

    for (const task of this._debugTools.tools) {
      this._measureData[task.id] = task.getTitle() + ": " + task.getInfo();
    }

    this._boundData = {};

    for (const toolData of this._debugTools.tools) {
      this._boundData[toolData.id] = makeObservable(this._measureData[toolData.id]);

      this._dataPane.addText(this._boundData[toolData.id], { title: toolData.id });
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
        if (this._boundData[task.id]) {
          this._boundData[task.id].set(task.getTitle() + ": " + task.getInfo());
        }
      }
    }
  }

  public init() {
    this.log(
      `Initializing extension [${this._session.extensionContext.extensionInfo.name}] for player [${this._session.extensionContext.player.name}]`
    );

    this._debugTools.notifyDisplayDataUpdatedList.push(this.updateDisplayData);

    this.createOuterPane();

    if (!this._watchOuterPane) {
      this.log("Unexpectedly could not create a pane.");
      return [];
    }

    const tool = this.addTool();
    tool.bindPropertyPane(this._watchOuterPane);

    this.tick();

    return [];
  }

  tick() {
    this._sessionTick++;

    if (this._watchToggleData) {
      for (const strId in this._watchToggleData) {
        const val = this._watchToggleData[strId];

        if (val === false && this._debugTools.hasToolById(strId)) {
          this._debugTools.removeToolById(strId);
          this.ensureDataPane();
          this._watchOuterPane?.show();
        } else if (val === true && !this._debugTools.hasToolById(strId)) {
          DebugToolRegistry.createToolInstance(strId);
          this.ensureDataPane();
          this._watchOuterPane?.show();
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
