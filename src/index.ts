#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { checkCapabilities, getCapabilityGapMessage } from "./utils/capabilities.js";
import { CliFormatter } from "./utils/formatter.js";

// Types
import {
  type McpToolResponse,
  type LintCodeArgs,
  type GuardSecurityArgs,
  type CatchBugsArgs,
} from "./types/tools.js";

// Infrastructure
import { PluginManager } from "./utils/plugin-manager.js";
import { CORE_TOOL_DEFINITIONS } from "./tools/definitions.js";
import { ToolRegistry } from "./tools/registry.js";
import { AppInfo } from "./utils/app-info.js";

// Tool Implementations
import { BaseTool } from "./tools/base.js";
import { performUniversalAudit as performAudit, type AuditReport } from "./best-practices.js";
import { performSecurityAudit, type SecurityAuditReport } from "./security-audit.js";
import { catchBugs, type BugReport as B_Report } from "./bug-catcher.js"; // docsgrep-ignore

// Initialize
const server = new Server(
  { name: AppInfo.name, version: AppInfo.version },
  { capabilities: { tools: {} } }
);

function wrap(data: any): McpToolResponse {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
  };
}

class LintCodeTool extends BaseTool<LintCodeArgs> {
  protected name = "lint_code";
  protected async run(args: LintCodeArgs): Promise<McpToolResponse> {
    const { dir, inc } = this.getStandardArgs(args);
    const caps = await checkCapabilities();
    const report: AuditReport = await performAudit(dir, inc, args.excludePath);
    report.recommendations.push(...getCapabilityGapMessage(caps));
    return wrap({ ...report, capabilities: caps });
  }
}

class GuardSecurityTool extends BaseTool<GuardSecurityArgs> {
  protected name = "guard_security";
  protected async run(args: GuardSecurityArgs): Promise<McpToolResponse> {
    const { dir, inc } = this.getStandardArgs(args);
    const caps = await checkCapabilities();
    const report: SecurityAuditReport = await performSecurityAudit(dir, inc, args.excludePath);
    report.recommendations.push(...getCapabilityGapMessage(caps));
    return wrap({ ...report, capabilities: caps });
  }
}

class CatchBugsTool extends BaseTool<CatchBugsArgs> {
  protected name = "catch_bugs";
  protected async run(args: CatchBugsArgs): Promise<McpToolResponse> {
    const { dir, inc } = this.getStandardArgs(args);
    const report: B_Report = await catchBugs(dir, inc, args.excludePath);
    return wrap(report);
  }
}

// -----------------------------------------------------------------------------
// Server Setup
// -----------------------------------------------------------------------------

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
    return handleErr(err);
  }
});

function handleErr(err: any) {
  if (err.message.includes("Unknown tool")) {
    throw new McpError(ErrorCode.MethodNotFound, err.message);
  }
  return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true } as any;
}

// -----------------------------------------------------------------------------
// CLI Engine
// -----------------------------------------------------------------------------

async function runCli(cliArgs: string[]) {
  const toolName = cliArgs[0];
  const coreTools = ToolRegistry.getCoreToolNames();
  const pluginTools = PluginManager.getRegisteredToolDefinitions().map(t => t.name);
  const availableTools = [...coreTools, ...pluginTools];

  if (!toolName || !availableTools.includes(toolName)) {
    displayCliHelp(availableTools);
    process.exit(toolName ? 1 : 0);
  }

  const { args, format } = parseCliArgs(cliArgs.slice(1));
  if (!args.dirPath && !args.projectPath && !args.filePath) {
    args.dirPath = process.cwd();
  }

  console.log(`\n🚀 docsgrep: Running tool '${toolName}'...`);

  try {
    const response = await ToolRegistry.execute(toolName, args);
    handleCliResponse(response, toolName, format);
  } catch (err: any) {
    console.error(`\n❌ Fatal Error: ${err.message}`);
    process.exit(1);
  }
}

function displayCliHelp(tools: string[]) {
  console.log("\n📖 docsgrep CLI - Clean Code & Documentation Assistant");
  console.log("Usage: docsgrep run {tool_name} [--param value] [--format text|json]");
  console.log("\nOptions:");
  console.log("  --format   Output format: 'text' (default) or 'json'");
  console.log("\nAvailable tools:");
  tools.sort().forEach(t => console.log(`  - ${t}`));
  console.log("\nExample: npm run lint OR npx docsgrep run lint_code --dirPath ./src --format text");
}

function parseCliArgs(cliArgs: string[]) {
  const toolArgs: any = {};
  let fmt = "text";

  for (let i = 0; i < cliArgs.length; i++) {
    const arg = cliArgs[i];
    if (!arg.startsWith("--")) continue;

    const [key, val] = arg.replace(/^--/, "").split("=");
    const final = getVal(cliArgs, i, val);
    if (val === undefined && final !== true) i++;

    if (key === "format") fmt = final;
    else toolArgs[key] = final;
  }
  return { args: toolArgs, format: fmt };
}

function getVal(args: string[], i: number, v: string | undefined): any {
  if (v !== undefined) return parseVal(v);
  const next = args[i + 1];
  if (next && !next.startsWith("--")) return parseVal(next);
  return true;
}

function parseVal(val: string): any {
  if (val === "true") return true;
  if (val === "false") return false;
  if (!isNaN(Number(val)) && val.trim() !== "") return Number(val);
  if (val.includes(",")) return val.split(",").map(item => item.trim());
  return val;
}

function handleCliResponse(res: McpToolResponse, tool: string, fmt: string) {
  if (res.isError) {
    console.error(`\n❌ Error:`, res.content[0].text);
    process.exit(1);
  }

  const text = res.content[0].text;
  if (fmt === "json") {
    outJson(text);
  } else {
    console.log(CliFormatter.format(text, tool));
  }
}

function outJson(text: string) {
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log(text);
  }
}

// -----------------------------------------------------------------------------
// Initialization
// -----------------------------------------------------------------------------

async function run() {
  const args = process.argv.slice(2);
  
  ToolRegistry.initialize({
    lint_code: (a) => new LintCodeTool().execute(a),
    guard_security: (a) => new GuardSecurityTool().execute(a),
    catch_bugs: (a) => new CatchBugsTool().execute(a),
  });

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
