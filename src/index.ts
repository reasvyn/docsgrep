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
import { MAX_FILE_SIZE_TECH, MAX_FILE_SIZE_CONVENTIONS, MAX_FILE_SIZE_SAMPLE } from "./utils/constants.js";

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

// Existing tool imports
import { performUniversalAudit as performAudit, generateUniversalAuditPrompt as generateAuditPrompt, type AuditReport } from "./best-practices.js";
import { getAuditPrompt } from "./audit.js";
import { performSecurityAudit, generateSecurityAuditPrompt, type SecurityAuditReport } from "./security-audit.js";
import { catchBugs, type BugReport } from "./bug-catcher.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.resolve(__dirname, "../package.json");
const pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));

// Initialize the MCP server
const server = new Server(
  {
    name: pkg.name,
    version: pkg.version,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define the tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "setup_camp",
        description:
          "Sets up a docsgrep base camp in the specified project directory to store temporary files, logs, and reports. Also automatically updates the .gitignore file.",
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
        description:
          "Spies on the project's technology stack by reading package manager files (e.g., package.json, composer.json, go.mod, Cargo.toml).",
        inputSchema: {
          type: "object",
          properties: {
            dirPath: {
              type: "string",
              description: "The absolute path to the local directory to analyze.",
            },
          },
          required: ["dirPath"],
        },
      },
      {
        name: "sniff_style",
        description:
          "Sniffs out project style: conventions, linters, and infers implicit coding patterns from codebase samples. Combines convention detection and code pattern analysis.",
        inputSchema: {
          type: "object",
          properties: {
            dirPath: {
              type: "string",
              description: "The absolute path to the local directory to analyze.",
            },
          },
          required: ["dirPath"],
        },
      },
      {
        name: "hunt_docs",
        description:
          "Hunts for README files and documentation inside docs/ folders in a local directory.",
        inputSchema: {
          type: "object",
          properties: {
            dirPath: {
              type: "string",
              description: "The absolute path to the local directory to explore.",
            },
          },
          required: ["dirPath"],
        },
      },
      {
        name: "fetch_repo",
        description:
          "Fetches a remote git repository to a temporary directory and finds documentation. Supports authentication for private repos.",
        inputSchema: {
          type: "object",
          properties: {
            repoUrl: {
              type: "string",
              description: "The URL of the git repository (e.g., https://github.com/user/repo.git).",
            },
            branch: {
              type: "string",
              description: "Optional. Specific branch to explore (e.g., 'docs', 'gh-pages', 'v14'). If not provided, explores the default branch.",
            },
            localProjectPath: {
              type: "string",
              description: "Optional. The absolute path to the local project to use its .docsgrep workspace for storing cloned repositories.",
            },
            authToken: {
              type: "string",
              description: "Optional. Authentication token for private repositories (GitHub PAT, GitLab token, etc.). For HTTPS URLs, this will be added to the URL.",
            },
            sshKeyPath: {
              type: "string",
              description: "Optional. Path to SSH private key for authentication. Uses ssh-agent or GIT_SSH_COMMAND.",
            }
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
          },
          required: ["dirPath"],
        },
      },
      // New tools
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
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "setup_camp":
      return await handleSetupCamp(request.params.arguments);
    case "spy_stack":
      return await handleSpyStack(request.params.arguments);
    case "sniff_style":
      return await handleSniffStyle(request.params.arguments);
    case "hunt_docs":
      return await handleHuntDocs(request.params.arguments);
    case "fetch_repo":
      return await handleFetchRepo(request.params.arguments);
    case "peek_file":
      return await handlePeekFile(request.params.arguments);
    case "purge_cache":
      return await handlePurgeCache(request.params.arguments);
    case "grep_docs":
      return await handleGrepDocs(request.params.arguments);
    case "lint_code": {
      const { dirPath: rawPath, filePatterns, focusAreas } = request.params
        .arguments as {
        dirPath: string;
        filePatterns?: string[];
        focusAreas?: string[];
      };

      try {
        const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));

        const release = await operationLimiter.acquire();
        try {
          logger.info("Starting universal code quality audit", {
            dirPath,
            filePatterns,
            focusAreas,
          });

          const report: AuditReport = await performAudit(
            dirPath,
            filePatterns
          );

          logger.info("Audit completed", {
            filesScanned: report.summary.filesScanned,
            totalIssues: report.summary.totalIssues,
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    message: `Audit completed: ${report.summary.totalIssues} issues across ${report.summary.filesScanned} files. Documentation Score: ${report.summary.documentationScore}/100, Code Quality Score: ${report.summary.codeQualityScore}/100`,
                    summary: report.summary,
                    projectStructure: report.projectStructure,
                    detectedConventions: report.detectedConventions || {},
                    issues: report.issues || [],
                    strengths: report.strengths || [],
                    recommendations: report.recommendations || [],
                    note:
                      report.issues && report.issues.length >= 100
                        ? "Results limited to 100 issues. There may be more issues."
                        : undefined,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } finally {
          release();
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error during audit: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }
    case "ask_lint": {
      const { dirPath: rawPath } = request.params.arguments as {
        dirPath: string;
      };

      try {
        const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));

        const prompt = await getAuditPrompt(dirPath);

        return {
          content: [
            {
              type: "text",
              text: prompt,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error generating audit prompt: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }
    case "guard_security": {
      const { dirPath: rawPath, filePatterns } = request.params
        .arguments as {
        dirPath: string;
        filePatterns?: string[];
      };

      try {
        const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));

        const release = await operationLimiter.acquire();
        try {
          logger.info("Starting security audit", { dirPath, filePatterns });

          const report: SecurityAuditReport = await performSecurityAudit(
            dirPath,
            filePatterns
          );

          logger.info("Security audit completed", {
            filesScanned: report.summary.filesScanned,
            totalIssues: report.summary.totalIssues,
            riskLevel: report.summary.riskLevel,
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    message: `Security audit completed: ${report.summary.totalIssues} issues found. Security Score: ${report.summary.securityScore}/100 (Risk Level: ${report.summary.riskLevel})`,
                    summary: report.summary,
                    owaspTop10: report.owaspTop10,
                    dependencyAnalysis: report.dependencyAnalysis,
                    secretsFound: report.secretsFound,
                    privacyIssues: report.privacyIssues,
                    complianceStatus: report.complianceStatus,
                    recommendations: report.recommendations,
                    note:
                      report.secretsFound.length >= 50
                        ? "Secrets list limited to 50 items."
                        : undefined,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } finally {
          release();
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error during security audit: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }
    case "ask_guard": {
      const { dirPath: rawPath } = request.params.arguments as {
        dirPath: string;
      };

      try {
        const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));

        const prompt = generateSecurityAuditPrompt(dirPath);

        return {
          content: [
            {
              type: "text",
              text: prompt,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error generating security audit prompt: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }
    case "catch_bugs": {
      const { dirPath: rawPath, filePatterns } = request.params
        .arguments as {
        dirPath: string;
        filePatterns?: string[];
      };

      try {
        const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));

        const release = await operationLimiter.acquire();
        try {
          logger.info("Starting bug catching", { dirPath, filePatterns });

          const report: BugReport = await catchBugs(dirPath, filePatterns);

          logger.info("Bug catching completed", {
            filesScanned: report.summary.filesScanned,
            totalIssues: report.summary.totalIssues,
            riskLevel: report.summary.riskLevel,
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    message: `Bug analysis completed: ${report.summary.totalIssues} issues found. Bug Score: ${report.summary.bugScore}/100 (Risk Level: ${report.summary.riskLevel})`,
                    summary: report.summary,
                    categories: report.categories,
                    recommendations: report.recommendations,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } finally {
          release();
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error during bug catching: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }
    case "fathom_meaning":
      return await handleFathomMeaning(request.params.arguments);
    case "tldr_docs":
      return await handleTldrDocs(request.params.arguments);
    case "hunt_related":
      return await handleHuntRelated(request.params.arguments);
    case "smell_stale":
      return await handleSmellStale(request.params.arguments);
    case "sync_docs":
      return await handleSyncDocs(request.params.arguments);
    case "verify_truth":
      return await handleVerifyTruth(request.params.arguments);
    case "sense_surroundings":
      return await handleSenseSurroundings(request.params.arguments);
    case "spot_delta":
      return await handleSpotDelta(request.params.arguments);
    case "doc_the_tools":
      return await handleDocTheTools(request.params.arguments);
    case "catch_fossils":
      return await handleCatchFossils(request.params.arguments);
    default:
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${request.params.name}`
      );
  }
});

// Run the server
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("docsgrep server is running on stdio");
}

run().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
