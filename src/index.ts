#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// Utilities
import { logger } from "./utils/logger.js";
import { operationLimiter } from "./utils/semaphore.js";
import { validateStringParam, validateDirPath } from "./utils/validation.js";
import { checkCapabilities, getCapabilityGapMessage } from "./utils/capabilities.js";
import { CliFormatter } from "./utils/formatter.js";

// Types
import {
  type McpToolResponse,
  type LintCodeArgs,
  type GuardSecurityArgs,
  type CatchBugsArgs,
  type AskLintArgs,
  type AskGuardArgs,
} from "./types/tools.js";

// Tool handlers
import { handleSetupCamp, handlePurgeCache } from "./tools/workspace.js";
import {
  handleHuntDocs,
  handlePeekFile,
  handleGrepDocs,
  handleFathomMeaning,
  handleTldrDocs,
  handleHuntRelated,
  handleSmellStale,
  handleSenseSurroundings,
  handleGaugeDocs,
} from "./tools/documentation.js";
import {
  handleSyncDocs,
  handleVerifyTruth,
  handleSpotDelta,
  handleCatchFossils,
} from "./tools/sync-verify.js";
import {
  handleDocTheTools,
  handleSpyStack,
  handleSniffStyle,
  handleFetchRepo,
} from "./tools/help-info.js";
import { handleMapArchetypesTool } from "./tools/archetypes.js";
import { handleAskLintTool, handleAskGuardTool } from "./tools/audit-ask.js";

// Plugins
import { PluginManager } from "./utils/plugin-manager.js";
import { CORE_TOOL_DEFINITIONS } from "./tools/definitions.js";

// Existing tool imports
import { performUniversalAudit as performAudit, type AuditReport } from "./best-practices.js";
import { getAuditPrompt } from "./audit.js";
import { performSecurityAudit, generateSecurityAuditPrompt, type SecurityAuditReport } from "./security-audit.js";
import { catchBugs, type BugReport } from "./bug-catcher.js";
import { AppInfo } from "./utils/app-info.js";

// Initialize the MCP server
const server = new Server(
  {
    name: AppInfo.name,
    version: AppInfo.version,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Modularized handlers to reduce nesting
import { BaseTool } from "./tools/base.js";

class LintCodeTool extends BaseTool<LintCodeArgs> {
  protected name = "lint_code";
  protected async run(args: LintCodeArgs): Promise<McpToolResponse> {
    const dirPath = validateDirPath(validateStringParam(args.dirPath, "dirPath"));
    const caps = await checkCapabilities();
    // Support legacy filePatterns as includePath
    const includePath = args.includePath || args.filePatterns;
    const report: AuditReport = await performAudit(dirPath, includePath, args.excludePath);
    const gapMessages = getCapabilityGapMessage(caps);
    report.recommendations.push(...gapMessages);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          message: `Audit completed: ${report.summary.totalIssues} issues across ${report.summary.filesScanned} files. Documentation Score: ${report.summary.documentationScore}/100, Code Quality Score: ${report.summary.codeQualityScore}/100`,
          summary: report.summary,
          projectStructure: report.projectStructure,
          detectedConventions: report.detectedConventions || {},
          issues: report.issues || [],
          strengths: report.strengths || [],
          recommendations: report.recommendations || [],
          capabilities: caps
        }, null, 2)
      }]
    };
  }
}

class GuardSecurityTool extends BaseTool<GuardSecurityArgs> {
  protected name = "guard_security";
  protected async run(args: GuardSecurityArgs): Promise<McpToolResponse> {
    const dirPath = validateDirPath(validateStringParam(args.dirPath, "dirPath"));
    const caps = await checkCapabilities();
    // Support legacy filePatterns
    const includePath = args.includePath || args.filePatterns;
    const report: SecurityAuditReport = await performSecurityAudit(dirPath, includePath, args.excludePath);
    const gapMessages = getCapabilityGapMessage(caps);
    report.recommendations.push(...gapMessages);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          message: `Security audit completed: ${report.summary.totalIssues} issues found. Security Score: ${report.summary.securityScore}/100`,
          summary: report.summary,
          owaspTop10: report.owaspTop10,
          dependencyAnalysis: report.dependencyAnalysis,
          secretsFound: report.secretsFound,
          privacyIssues: report.privacyIssues,
          complianceStatus: report.complianceStatus,
          recommendations: report.recommendations,
          capabilities: caps
        }, null, 2)
      }]
    };
  }
}

class CatchBugsTool extends BaseTool<CatchBugsArgs> {
  protected name = "catch_bugs";
  protected async run(args: CatchBugsArgs): Promise<McpToolResponse> {
    const dirPath = validateDirPath(validateStringParam(args.dirPath, "dirPath"));
    // Support legacy filePatterns
    const includePath = args.includePath || args.filePatterns;
    const report: BugReport = await catchBugs(dirPath, includePath, args.excludePath);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          message: `Bug analysis completed: ${report.summary.totalIssues} issues found. Bug Score: ${report.summary.bugScore}/100`,
          summary: report.summary,
          categories: report.categories,
          recommendations: report.recommendations
        }, null, 2)
      }]
    };
  }
}

// Wrapper handlers for modularized tools
async function handleLintCodeTool(args: any) { return await new LintCodeTool().execute(args); }
async function handleGuardSecurityTool(args: any) { return await new GuardSecurityTool().execute(args); }
async function handleCatchBugsTool(args: any) { return await new CatchBugsTool().execute(args); }

// Register all tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const response = {
    tools: CORE_TOOL_DEFINITIONS,
  };

  // Add plugin tools
  const pluginTools = PluginManager.getRegisteredToolDefinitions();
  response.tools.push(...pluginTools as any);

  return response;
});


server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "setup_camp":
        return await handleSetupCamp(args as any);
      case "spy_stack":
        return await handleSpyStack(args as any);
      case "sniff_style":
        return await handleSniffStyle(args as any);
      case "hunt_docs":
        return await handleHuntDocs(args as any);
      case "fetch_repo":
        return await handleFetchRepo(args as any);
      case "peek_file":
        return await handlePeekFile(args as any);
      case "purge_cache":
        return await handlePurgeCache(args as any);
      case "grep_docs":
        return await handleGrepDocs(args as any);
      case "lint_code":
        return await handleLintCodeTool(args as any);
      case "ask_lint":
        return await handleAskLintTool(args as any);
      case "guard_security":
        return await handleGuardSecurityTool(args as any);
      case "ask_guard":
        return await handleAskGuardTool(args as any);
      case "catch_bugs":
        return await handleCatchBugsTool(args as any);
      case "fathom_meaning":
        return await handleFathomMeaning(args as any);
      case "tldr_docs":
        return await handleTldrDocs(args as any);
      case "hunt_related":
        return await handleHuntRelated(args as any);
      case "smell_stale":
        return await handleSmellStale(args as any);
      case "sync_docs":
        return await handleSyncDocs(args as any);
      case "verify_truth":
        return await handleVerifyTruth(args as any);
      case "sense_surroundings":
        return await handleSenseSurroundings(args as any);
      case "spot_delta":
        return await handleSpotDelta(args as any);
      case "doc_the_tools":
        return await handleDocTheTools(args as any);
      case "catch_fossils":
        return await handleCatchFossils(args as any);
      case "gauge_docs":
        return await handleGaugeDocs(args as any);
      case "map_archetypes":
        return await handleMapArchetypesTool(args as any);
      default:
        // Try plugin handlers
        const pluginHandler = PluginManager.getHandler(name);
        if (pluginHandler) {
          return await pluginHandler(args);
        }

        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    } as any;
  }
});

// Run the server or CLI mode
async function run() {
  const args = process.argv.slice(2);
  
  // Initialize plugins
  await PluginManager.discoverPlugins();

  if (args[0] === "run") {
    await runCli(args.slice(1));
    return;
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("docsgrep server is running on stdio");
}

/**
 * Simple CLI runner for manual execution
 * Usage: docsgrep run {tool_name} [--param1 value1 --format text|json]
 */
async function runCli(cliArgs: string[]) {
  const toolName = cliArgs[0];
  const coreTools = [
    "setup_camp", "spy_stack", "sniff_style", "hunt_docs", "fetch_repo",
    "peek_file", "purge_cache", "grep_docs", "lint_code", "ask_lint",
    "guard_security", "ask_guard", "catch_bugs", "fathom_meaning",
    "tldr_docs", "hunt_related", "smell_stale", "sync_docs",
    "verify_truth", "sense_surroundings", "spot_delta", "doc_the_tools",
    "catch_fossils", "gauge_docs", "map_archetypes"
  ];
  const pluginTools = PluginManager.getRegisteredToolDefinitions().map(t => t.name);
  const availableTools = [...coreTools, ...pluginTools];

  if (!toolName || !availableTools.includes(toolName)) {
    console.log("\n📖 docsgrep CLI - Clean Code & Documentation Assistant");
    console.log("Usage: docsgrep run {tool_name} [--param value] [--format text|json]");
    console.log("\nOptions:");
    console.log("  --format   Output format: 'text' (default) or 'json'");
    console.log("\nAvailable tools:");
    availableTools.sort().forEach(t => console.log(`  - ${t}`));
    console.log("\nExample: npm run lint OR npx docsgrep run lint_code --dirPath ./src --format text");
    process.exit(toolName ? 1 : 0);
  }

  // Parse arguments: --key value or --key=value
  const toolArgs: any = {};
  let outputFormat = "text"; // Default for CLI

  for (let i = 1; i < cliArgs.length; i++) {
    const arg = cliArgs[i];
    if (arg.startsWith("--")) {
      const [key, val] = arg.replace(/^--/, "").split("=");

      let finalVal: any;
      if (val !== undefined) {
        finalVal = parseValue(val);
      } else if (cliArgs[i + 1] && !cliArgs[i + 1].startsWith("--")) {
        finalVal = parseValue(cliArgs[i + 1]);
        i++;
      } else {
        finalVal = true; // Boolean flag
      }

      if (key === "format") {
        outputFormat = finalVal;
      } else {
        toolArgs[key] = finalVal;
      }
    }
  }

  // Default dirPath to current directory if not provided
  if (!toolArgs.dirPath && !toolArgs.projectPath && !toolArgs.filePath) {
    toolArgs.dirPath = process.cwd();
  }

  console.log(`\n🚀 docsgrep: Running tool '${toolName}'...`);

  try {
    const response = await executeToolByName(toolName, toolArgs);
    if (response.isError) {
      console.error(`\n❌ Error:`, response.content[0].text);
      process.exit(1);
    }

    const content = response.content[0].text;

    if (outputFormat === "json") {
      try {
        console.log(`\n✅ Results (JSON):\n`);
        console.log(JSON.stringify(JSON.parse(content), null, 2));
      } catch {
        console.log(`\n✅ Results:\n`);
        console.log(content);
      }
    } else {
      // Human-friendly text format (Default)
      console.log(CliFormatter.format(content, toolName));
    }
  } catch (error: any) {
    console.error(`\n❌ Fatal Error: ${error.message}`);
    process.exit(1);
  }
}


function parseValue(val: string): any {
  if (val === "true") return true;
  if (val === "false") return false;
  if (!isNaN(Number(val)) && val.trim() !== "") return Number(val);
  if (val.includes(",")) return val.split(",").map(v => v.trim());
  return val;
}

async function executeToolByName(name: string, args: any): Promise<McpToolResponse> {
  switch (name) {
    case "setup_camp":
      return await handleSetupCamp(args);
    case "spy_stack":
      return await handleSpyStack(args);
    case "sniff_style":
      return await handleSniffStyle(args);
    case "hunt_docs":
      return await handleHuntDocs(args);
    case "fetch_repo":
      return await handleFetchRepo(args);
    case "peek_file":
      return await handlePeekFile(args);
    case "purge_cache":
      return await handlePurgeCache(args);
    case "grep_docs":
      return await handleGrepDocs(args);
    case "lint_code":
      return await handleLintCodeTool(args);
    case "ask_lint":
      return await handleAskLintTool(args);
    case "guard_security":
      return await handleGuardSecurityTool(args);
    case "ask_guard":
      return await handleAskGuardTool(args);
    case "catch_bugs":
      return await handleCatchBugsTool(args);
    case "fathom_meaning":
      return await handleFathomMeaning(args);
    case "tldr_docs":
      return await handleTldrDocs(args);
    case "hunt_related":
      return await handleHuntRelated(args);
    case "smell_stale":
      return await handleSmellStale(args);
    case "sync_docs":
      return await handleSyncDocs(args);
    case "verify_truth":
      return await handleVerifyTruth(args);
    case "sense_surroundings":
      return await handleSenseSurroundings(args);
    case "spot_delta":
      return await handleSpotDelta(args);
    case "doc_the_tools":
      return await handleDocTheTools(args);
    case "catch_fossils":
      return await handleCatchFossils(args);
    case "gauge_docs":
      return await handleGaugeDocs(args);
    case "map_archetypes":
      return await handleMapArchetypesTool(args);
    default:
      const pluginHandler = PluginManager.getHandler(name);
      if (pluginHandler) {
        return await pluginHandler(args);
      }
      throw new Error(`Unknown tool: ${name}`);
  }
}

run().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
