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

// Plugins
import { PluginManager } from "./utils/plugin-manager.js";

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

async function handleAskLintTool(args: any): Promise<McpToolResponse> {
  const dirPath = validateDirPath(validateStringParam(args.dirPath, "dirPath"));
  const prompt = await getAuditPrompt(dirPath);
  return { content: [{ type: "text", text: prompt }] };
}

async function handleAskGuardTool(args: any): Promise<McpToolResponse> {
  const dirPath = validateDirPath(validateStringParam(args.dirPath, "dirPath"));
  const prompt = await generateSecurityAuditPrompt(dirPath);
  return { content: [{ type: "text", text: prompt }] };
}

// Register all tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const response = {
    tools: [
      {
        name: "setup_camp",
        description: "Sets up a docsgrep base camp in the specified project directory to store temporary files, logs, and reports. Also automatically updates the .gitignore file.",
        inputSchema: {
          type: "object",
          properties: {
            projectPath: {
              type: "string",
              description: "The absolute path to the local project root.",
            },
          },
          required: ["projectPath"],
        },
      },
      {
        name: "spy_stack",
        description: "Spies on the project's technology stack by reading package manager files (e.g., package.json, composer.json, go.mod, Cargo.toml).",
        inputSchema: {
          type: "object",
          properties: {
            dirPath: {
              type: "string",
              description: "The absolute path to the local directory to analyze.",
            },
            excludePath: {
              type: "array",
              items: { type: "string" },
              description: "Optional. Glob patterns to exclude from scanning.",
            },
          },
          required: ["dirPath"],
        },
      },
      {
        name: "sniff_style",
        description: "Sniffs out project style: conventions, linters, and infers implicit coding patterns from codebase samples. Combines convention detection and code pattern analysis.",
        inputSchema: {
          type: "object",
          properties: {
            dirPath: {
              type: "string",
              description: "The absolute path to the local directory to analyze.",
            },
            excludePath: {
              type: "array",
              items: { type: "string" },
              description: "Optional. Glob patterns to exclude from scanning.",
            },
          },
          required: ["dirPath"],
        },
      },
      {
        name: "hunt_docs",
        description: "Hunts for README files and documentation inside docs/ folders in a local directory.",
        inputSchema: {
          type: "object",
          properties: {
            dirPath: {
              type: "string",
              description: "The absolute path to the local directory to explore.",
            },
            includePath: {
              type: "array",
              items: { type: "string" },
              description: "Optional. Glob patterns to include in scanning.",
            },
            excludePath: {
              type: "array",
              items: { type: "string" },
              description: "Optional. Glob patterns to exclude from scanning.",
            },
          },
          required: ["dirPath"],
        },
      },
      {
        name: "fetch_repo",
        description: "Fetches a remote git repository to a temporary directory and finds documentation. Supports authentication for private repos.",
        inputSchema: {
          type: "object",
          properties: {
            repoUrl: {
              type: "string",
              description: "The URL of the git repository (e.g., https://github.com/user/repo.git).",
            },
            branch: {
              type: "string",
              description: "Optional. Specific branch to explore (e.g., 'docs', 'main').",
            },
            tag: {
              type: "string",
              description: "Optional. Specific tag or version to explore (e.g., 'v1.0.0'). Overrides branch if both are provided.",
            },
            authToken: {
              type: "string",
              description: "Optional. Authentication token for private repositories (GitHub PAT, GitLab token, etc.). For HTTPS URLs, this will be added to the URL.",
            },
            sshKeyPath: {
              type: "string",
              description: "Optional. Path to SSH private key for authentication. Uses ssh-agent or GIT_SSH_COMMAND.",
            },
            localProjectPath: {
              type: "string",
              description: "Optional. The absolute path to the local project to use its .docsgrep workspace for storing cloned repositories.",
            },
          },
          required: ["repoUrl"],
        },
      },
      {
        name: "peek_file",
        description: "Peeks into the contents of a specific documentation or README file.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "The absolute path to the file to read.",
            },
          },
          required: ["filePath"],
        },
      },
      {
        name: "purge_cache",
        description: "Purges old cached repositories from the .docsgrep workspace. Removes repos older than the specified max age (default 7 days).",
        inputSchema: {
          type: "object",
          properties: {
            localProjectPath: {
              type: "string",
              description: "The absolute path to the local project containing .docsgrep workspace.",
            },
            maxAgeDays: {
              type: "number",
              description: "Maximum age in days for cached repos (default: 7).",
            },
          },
          required: ["localProjectPath"],
        },
      },
      {
        name: "grep_docs",
        description: "Greps for a pattern within documentation files (README, docs/**/*.md) in a local directory. Returns matching lines with file path and line number. Results ranked by relevance.",
        inputSchema: {
          type: "object",
          properties: {
            dirPath: {
              type: "string",
              description: "The absolute path to the local directory to search.",
            },
            pattern: {
              type: "string",
              description: "The regex pattern to search for in documentation files.",
            },
            filePattern: {
              type: "string",
              description: "Optional. Regex pattern to filter which documentation files to search (e.g., 'README.*').",
            },
            contextLines: {
              type: "number",
              description: "Optional. Number of surrounding context lines to include (max 5).",
            },
            includePath: {
              type: "array",
              items: { type: "string" },
              description: "Optional. Glob patterns to include in scanning.",
            },
            excludePath: {
              type: "array",
              items: { type: "string" },
              description: "Optional. Glob patterns to exclude from scanning.",
            },
          },
          required: ["dirPath", "pattern"],
        },
      },
      {
        name: "lint_code",
        description: "Performs an enterprise-grade code quality audit (linting). Analyzes tech stack, conventions, and applies industry best practices to detect issues like dead code, god classes, SOC violations, and more.",
        inputSchema: {
          type: "object",
          properties: {
            dirPath: {
              type: "string",
              description: "The absolute path to the local directory to audit.",
            },
            filePatterns: {
              type: "array",
              items: { type: "string" },
              description: "Optional. Array of glob patterns to specify which files to audit (e.g., ['src/**/*.tsx']).",
            },
            focusAreas: {
              type: "array",
              items: { type: "string" },
              description: "Optional. Focus audit on specific areas: 'dead_code', 'structure', 'performance', 'naming', 'all'.",
            },
            includePath: {
              type: "array",
              items: { type: "string" },
              description: "Optional. Glob patterns to include in scanning.",
            },
            excludePath: {
              type: "array",
              items: { type: "string" },
              description: "Optional. Glob patterns to exclude from scanning.",
            },
          },
          required: ["dirPath"],
        },
      },
      {
        name: "ask_lint",
        description: "Asks what you want to lint. Generates an interactive prompt showing detected tech stack and available linting options.",
        inputSchema: {
          type: "object",
          properties: {
            dirPath: {
              type: "string",
              description: "The absolute path to the local directory.",
            },
          },
          required: ["dirPath"],
        },
      },
      {
        name: "guard_security",
        description: "Guards your code with enterprise-grade security audit covering OWASP Top 10, ISO/IEC 27001, secrets detection, privacy (GDPR/CCPA), and dependency vulnerabilities. Provides comprehensive security analysis with remediation steps.",
        inputSchema: {
          type: "object",
          properties: {
            dirPath: {
              type: "string",
              description: "The absolute path to the local directory to audit.",
            },
            filePatterns: {
              type: "array",
              items: { type: "string" },
              description: "Optional. Array of glob patterns to specify which files to scan (e.g., ['**/*.js', '**/*.env']).",
            },
            includePath: {
              type: "array",
              items: { type: "string" },
              description: "Optional. Glob patterns to include in scanning.",
            },
            excludePath: {
              type: "array",
              items: { type: "string" },
              description: "Optional. Glob patterns to exclude from scanning.",
            },
          },
          required: ["dirPath"],
        },
      },
      {
        name: "ask_guard",
        description: "Asks before guarding. Shows what will be scanned (OWASP Top 10, secrets, privacy, dependencies) and available options.",
        inputSchema: {
          type: "object",
          properties: {
            dirPath: {
              type: "string",
              description: "The absolute path to the local directory.",
            },
          },
          required: ["dirPath"],
        },
      },
      {
        name: "catch_bugs",
        description: "Catches bugs, errors, warnings, and potential issues in code: race conditions, memory leaks, runtime errors, dependency coupling, and performance issues with large data handling.",
        inputSchema: {
          type: "object",
          properties: {
            dirPath: {
              type: "string",
              description: "The absolute path to the local directory to analyze.",
            },
            filePatterns: {
              type: "array",
              items: { type: "string" },
              description: "Optional. Array of glob patterns to specify which files to scan (e.g., ['src/**/*.ts']).",
            },
            includePath: {
              type: "array",
              items: { type: "string" },
              description: "Optional. Glob patterns to include in scanning.",
            },
            excludePath: {
              type: "array",
              items: { type: "string" },
              description: "Optional. Glob patterns to exclude from scanning.",
            },
          },
          required: ["dirPath"],
        },
      },
      {
        name: "fathom_meaning",
        description: "Searches documentation based on meaning (semantic search), not just keyword matching. Understands natural language queries and finds relevant docs.",
        inputSchema: {
          type: "object",
          properties: {
            dirPath: {
              type: "string",
              description: "The absolute path to the local directory to search.",
            },
            query: {
              type: "string",
              description: "Natural language query about what you're looking for.",
            },
            topK: {
              type: "number",
              description: "Optional. Number of top results to return (default: 5).",
            },
          },
          required: ["dirPath", "query"],
        },
      },
      {
        name: "tldr_docs",
        description: "Automatically summarizes specific documentation files into concise, digestible chunks. Gets the essence without the noise.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "The absolute path to the documentation file to summarize.",
            },
            maxLength: {
              type: "number",
              description: "Optional. Maximum summary length in characters (default: 500).",
            },
          },
          required: ["filePath"],
        },
      },
      {
        name: "hunt_related",
        description: "Hunts for documentation related to a specific topic, pattern, or concept. Uses similarity matching to find docs that cover the same domain.",
        inputSchema: {
          type: "object",
          properties: {
            dirPath: {
              type: "string",
              description: "The absolute path to the local directory to search.",
            },
            topic: {
              type: "string",
              description: "Topic or concept to find related docs for.",
            },
            threshold: {
              type: "number",
              description: "Optional. Similarity threshold 0-1 (default: 0.7).",
            },
          },
          required: ["dirPath", "topic"],
        },
      },
      {
        name: "smell_stale",
        description: "Sniffs out documentation that has gone stale - not updated in 30+ days or out of sync with the actual code.",
        inputSchema: {
          type: "object",
          properties: {
            dirPath: {
              type: "string",
              description: "The absolute path to the local directory to check.",
            },
            maxAgeDays: {
              type: "number",
              description: "Optional. Maximum age in days before considered stale (default: 30).",
            },
            compareWithCode: {
              type: "boolean",
              description: "Optional. Also check if docs match current code (default: true).",
            },
          },
          required: ["dirPath"],
        },
      },
      {
        name: "sync_docs",
        description: "Automatically creates or updates documentation based on code changes. Detects new methods, changed signatures, and generates doc stubs.",
        inputSchema: {
          type: "object",
          properties: {
            dirPath: {
              type: "string",
              description: "The absolute path to the local project.",
            },
            filePaths: {
              type: "array",
              items: { type: "string" },
              description: "Optional. Specific files that changed (default: auto-detect from git).",
            },
            updateMode: {
              type: "string",
              description: "Optional. 'create', 'update', or 'both' (default: 'update').",
            },
          },
          required: ["dirPath"],
        },
      },
      {
        name: "verify_truth",
        description: "Checks consistency between code and documentation. Verifies that all documented methods actually exist and that parameters match reality.",
        inputSchema: {
          type: "object",
          properties: {
            dirPath: {
              type: "string",
              description: "The absolute path to the local project.",
            },
            docPath: {
              type: "string",
              description: "The path to the documentation file to validate.",
            },
            strictMode: {
              type: "boolean",
              description: "Optional. Fail on warnings too (default: false).",
            },
          },
          required: ["dirPath", "docPath"],
        },
      },
      {
        name: "sense_surroundings",
        description: "Automatically provides relevant documentation context based on what code you're currently working on. No need to ask - it just knows.",
        inputSchema: {
          type: "object",
          properties: {
            dirPath: {
              type: "string",
              description: "The absolute path to the local project.",
            },
            currentFilePath: {
              type: "string",
              description: "The path to the file currently being worked on.",
            },
            contextDepth: {
              type: "string",
              description: "Optional. 'minimal', 'standard', or 'deep' (default: 'standard').",
            },
          },
          required: ["dirPath", "currentFilePath"],
        },
      },
      {
        name: "spot_delta",
        description: "Compares what's documented versus what's actually in the code. Shows the delta between documentation claims and implementation reality.",
        inputSchema: {
          type: "object",
          properties: {
            dirPath: {
              type: "string",
              description: "The absolute path to the local project.",
            },
            docPath: {
              type: "string",
              description: "The path to the documentation file.",
            },
            includeCodeSnippets: {
              type: "boolean",
              description: "Optional. Include actual code in diff (default: true).",
            },
          },
          required: ["dirPath", "docPath"],
        },
      },
      {
        name: "doc_the_tools",
        description: "Provides comprehensive help for all docsgrep tools with detailed examples, common patterns, and pro tips.",
        inputSchema: {
          type: "object",
          properties: {
            toolName: {
              type: "string",
              description: "Optional. Specific tool to get help for (default: all tools).",
            },
            includeExamples: {
              type: "boolean",
              description: "Optional. Include usage examples (default: true).",
            },
          },
        },
      },
      {
        name: "catch_fossils",
        description: "Analyzes which documentation artifacts need updates based on recent codebase changes. Uses git diff to prioritize doc updates.",
        inputSchema: {
          type: "object",
          properties: {
            dirPath: {
              type: "string",
              description: "The absolute path to the local project.",
            },
            sinceCommit: {
              type: "string",
              description: "Optional. Check changes since this commit (default: last commit).",
            },
            priorityMode: {
              type: "string",
              description: "Optional. 'impact' or 'recency' (default: 'impact').",
            },
          },
          required: ["dirPath"],
        },
      },
      {
        name: "gauge_docs",
        description: "Measures documentation coverage (docblocks) across the codebase. Language-agnostic support for JS, TS, PHP, Python, Go, Rust, etc.",
        inputSchema: {
          type: "object",
          properties: {
            dirPath: {
              type: "string",
              description: "The absolute path to the source directory.",
            },
            filePatterns: {
              type: "array",
              items: { type: "string" },
              description: "Optional. Glob patterns to filter source files.",
            },
            publicOnly: {
              type: "boolean",
              description: "Optional. Only count public APIs (exported/public). Defaults to true.",
            },
            includePath: {
              type: "array",
              items: { type: "string" },
              description: "Optional. Glob patterns to include in scanning.",
            },
            excludePath: {
              type: "array",
              items: { type: "string" },
              description: "Optional. Glob patterns to exclude from scanning.",
            },
          },
          required: ["dirPath"],
        },
      },
      {
        name: "map_archetypes",
        description: "Maps project architectural patterns (MVC, Repository, etc.) and suggests refactoring candidates (Base Class, Trait, Interface).",
        inputSchema: {
          type: "object",
          properties: {
            dirPath: {
              type: "string",
              description: "The absolute path to the project directory.",
            },
            minSimilarity: {
              type: "number",
              description: "Minimum similarity score (0-1) to suggest abstraction. Default: 0.8",
            },
            focus: {
              type: "string",
              enum: ["interface", "base_class", "trait", "all"],
              description: "Optional focus area for suggestions.",
            },
            includePath: {
              type: "array",
              items: { type: "string" },
              description: "Optional glob patterns to include in scanning.",
            },
            excludePath: {
              type: "array",
              items: { type: "string" },
              description: "Optional glob patterns to exclude from scanning.",
            },

          },
          required: ["dirPath"],
        },
      },
    ],
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
    "lint_code", "guard_security", "catch_bugs", "gauge_docs", 
    "smell_stale", "sniff_style", "spy_stack", "hunt_docs", 
    "grep_docs", "fathom_meaning", "tldr_docs", "sync_docs", 
    "verify_truth", "spot_delta", "catch_fossils", "map_archetypes"
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
