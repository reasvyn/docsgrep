/**
 * Plugin system types
 */
import { type McpToolResponse } from "./tools.js";

export interface PluginToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export type PluginToolHandler = (args: any) => Promise<McpToolResponse>;

export interface DocsgrepPlugin {
  name: string;
  version: string;
  description?: string;
  tools: {
    definitions: PluginToolDefinition[];
    handlers: Record<string, PluginToolHandler>;
  };
  onLoad?: () => Promise<void>;
  onUnload?: () => Promise<void>;
}

export interface PluginMetadata {
  name: string;
  version: string;
  path: string;
  enabled: boolean;
}
