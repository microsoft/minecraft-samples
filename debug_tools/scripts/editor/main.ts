import DebugTools from "../DebugTools";
import { registerExtension } from "./DebugToolsEditorExtension";

export const debugTools = new DebugTools();
debugTools.init();

registerExtension(debugTools);
