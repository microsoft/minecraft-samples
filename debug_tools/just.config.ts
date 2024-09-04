import { argv, parallel, series, task, tscTask } from "just-scripts";
import path from "path";

import {
  bundleTask,
  BundleTaskParameters,
  CopyTaskParameters,
  cleanTask,
  cleanCollateralTask,
  copyTask,
  coreLint,
  mcaddonTask,
  setupEnvironment,
  ZipTaskParameters,
  STANDARD_CLEAN_PATHS,
  getOrThrowFromProcess,
  watchTask,
} from "@minecraft/core-build-tasks";

// Setup env variables
function setEnvIngame() {
  setupEnvironment(path.resolve(__dirname, ".env-ingame"));
}

function setEnvEditor() {
  setupEnvironment(path.resolve(__dirname, ".env-editor"));
}

const bundleIngameTaskOptions: BundleTaskParameters = {
  entryPoint: path.join(__dirname, "./scripts/ingame/main.ts"),
  external: ["@minecraft/server", "@minecraft/server-ui"],
  outfile: path.resolve(__dirname, "./dist/ingame/scripts/main.js"),
  minifyWhitespace: false,
  sourcemap: true,
  outputSourcemapPath: path.resolve(__dirname, "./dist/ingame/debug"),
};

const bundleEditorTaskOptions: BundleTaskParameters = {
  entryPoint: path.join(__dirname, "./scripts/editor/main.ts"),
  external: ["@minecraft/server", "@minecraft/server-gametest", "@minecraft/server-ui", "@minecraft/server-editor"],
  outfile: path.resolve(__dirname, "./dist/editor/scripts/main.js"),
  minifyWhitespace: false,
  sourcemap: true,
  outputSourcemapPath: path.resolve(__dirname, "./dist/editor/debug"),
};

const copyTaskIngameOptions: CopyTaskParameters = {
  copyToBehaviorPacks: [`./behavior_packs/debug_tools_ingame`, `./behavior_packs/common`],
  copyToScripts: ["./dist/ingame/scripts"],
  copyToResourcePacks: [`./resource_packs/debug_tools_ingame`, `./resource_packs/common`],
};

const copyTaskEditorOptions: CopyTaskParameters = {
  copyToBehaviorPacks: [`./behavior_packs/debug_tools_editor`, `./behavior_packs/common`],
  copyToScripts: ["./dist/editor/scripts"],
  copyToResourcePacks: [`./resource_packs/debug_tools_editor`, `./resource_packs/common`],
};

const mcaddonTaskIngameOptions: ZipTaskParameters = {
  ...copyTaskIngameOptions,
  outputFile: `./dist/packages/debug_tools_ingame.mcaddon`,
};

const mcaddonTaskEditorOptions: ZipTaskParameters = {
  ...copyTaskEditorOptions,
  outputFile: `./dist/packages/debug_tools_editor.mcaddon`,
};

// Lint
task("lint", coreLint(["scripts/**/*.ts"], argv().fix));

// Build
task(
  "typescript-editor",
  tscTask({
    project: "tsconfig.editor.json",
  })
);

task(
  "typescript-ingame",
  tscTask({
    project: "tsconfig.ingame.json",
  })
);

task("setEnvIngame", setEnvIngame);
task("setEnvEditor", setEnvEditor);

task("bundle-ingame", bundleTask(bundleIngameTaskOptions));
task("bundle-editor", bundleTask(bundleEditorTaskOptions));

task("build-ingame", series("typescript-ingame", "bundle-ingame"));
task("build-editor", series("typescript-editor", "bundle-editor"));

// Clean
task("clean-local-editor", cleanTask(["lib/editor", "dist/editor"]));
task("clean-local-ingame", cleanTask(["lib/ingame", "dist/ingame"]));
task("clean-collateral-usingenv", cleanCollateralTask(STANDARD_CLEAN_PATHS));
task("clean", parallel("clean-local-editor", "clean-local-ingame", "clean-collateral-usingenv"));

// Package
task("copyArtifacts-ingame", series(setEnvIngame, copyTask(copyTaskIngameOptions)));
task("copyArtifacts-editor", series(setEnvEditor, copyTask(copyTaskEditorOptions)));

task("package-ingame", series("clean-collateral-usingenv", "copyArtifacts-ingame"));
task("package-editor", series("clean-collateral-usingenv", "copyArtifacts-editor"));

// Local Deploy used for deploying local changes directly to output via the bundler. It does a full build and package first just in case.
task(
  "local-deploy",
  watchTask(
    ["scripts/**/*.ts", "behavior_packs/**/*.{json,lang,png}", "resource_packs/**/*.{json,lang,png}"],
    series(setEnvIngame, "clean-local-ingame", "build-ingame", "package-ingame")
  )
);
task(
  "local-deploy-editor",
  watchTask(
    ["scripts/**/*.ts", "behavior_packs/**/*.{json,lang,png}", "resource_packs/**/*.{json,lang,png}"],
    series("setEnvEditor", "clean-local-editor", "build-editor", "package-editor")
  )
);

// Mcaddon
task("create-ingame-mcaddon-file", series(setEnvIngame, mcaddonTask(mcaddonTaskIngameOptions)));
task("create-editor-mcaddon-file", series(setEnvEditor, mcaddonTask(mcaddonTaskEditorOptions)));

task("mcaddon-ingame", series("clean-local-ingame", "build-ingame", "create-ingame-mcaddon-file"));
