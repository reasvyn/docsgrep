#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { PluginManager } from "./utils/plugin-manager.js";
import { CORE_TOOL_DEFINITIONS } from "./tools/definitions.js";
import { ToolRegistry } from "./tools/registry.js";
import { AppInfo } from "./utils/app-info.js";
import { runCli } from "./cli.js";

const server = new Server(
  { name: AppInfo.name, version: AppInfo.version },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const pluginTools = PluginManager.getRegisteredToolDefinitions();
  return {
    tools: [...CORE_TOOL_DEFINITIONS, ...pluginTools as any]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    return await ToolRegistry.execute(name, args);
  } catch (err: any) {
    if (err.message.includes("Unknown tool")) {
      throw new McpError(ErrorCode.MethodNotFound, err.message);
    }
    return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true } as any;
  }
});

async function run() {
  const args = process.argv.slice(2);
  
  ToolRegistry.initialize();

  await PluginManager.discoverPlugins();

  if (args[0] === "run") {
    await runCli(args.slice(1));
    return;
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("docsgrep server is running on stdio");
}

run().catch((err) => {
  console.error("Fatal error running server:", err);
  process.exit(1);
});
