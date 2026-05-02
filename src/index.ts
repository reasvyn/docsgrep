#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { glob } from "glob";
import { simpleGit, type SimpleGit } from "simple-git";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { performUniversalAudit as performAudit, generateUniversalAuditPrompt as generateAuditPrompt, type AuditReport } from "./best-practices.js";
import { getAuditPrompt } from "./audit.js";
import { performSecurityAudit, generateSecurityAuditPrompt, type SecurityAuditReport } from "./security-audit.js";

// Structured logger
class Logger {
  private context: string;
  
  constructor(context: string) {
    this.context = context;
  }
  
  info(message: string, meta?: Record<string, any>) {
    console.error(JSON.stringify({ level: 'info', context: this.context, message, timestamp: new Date().toISOString(), ...meta }));
  }
  
  error(message: string, meta?: Record<string, any>) {
    console.error(JSON.stringify({ level: 'error', context: this.context, message, timestamp: new Date().toISOString(), ...meta }));
  }
  
  warn(message: string, meta?: Record<string, any>) {
    console.error(JSON.stringify({ level: 'warn', context: this.context, message, timestamp: new Date().toISOString(), ...meta }));
  }
}

const logger = new Logger('docsgrep');

// Concurrency limiter
class Semaphore {
  private permits: number;
  private queue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<() => void> {
    if (this.permits > 0) {
      this.permits--;
      return () => this.release();
    }

    return new Promise((resolve) => {
      this.queue.push(() => {
        this.permits--;
        resolve(() => this.release());
      });
    });
  }

  private release() {
    this.permits++;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next?.();
    }
  }
}

const operationLimiter = new Semaphore(5); // Max 5 concurrent operations

interface ToolResponse {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

const MAX_FILE_SIZE_TECH = 50000;
const MAX_FILE_SIZE_CONVENTIONS = 100000;
const MAX_FILE_SIZE_SAMPLE = 20000;
const MAX_FILE_SIZE_READ = 500000; // 500KB for read_doc_file
const GIT_TIMEOUT_MS = 60000;
const MAX_CACHE_SIZE_MB = 1000; // 1GB max cache size
const MAX_RETRY_ATTEMPTS = 3;

export function validateStringParam(param: unknown, paramName: string): string {
  if (typeof param !== "string" || !param.trim()) {
    throw new Error(`Invalid ${paramName}: must be a non-empty string`);
  }
  return param.trim();
}

export function validateDirPath(dirPath: string): string {
  const resolved = path.resolve(dirPath);
  // Check if the original path tries to traverse above by having '..' that would escape
  // We do this by checking if the resolved path is different from what we'd get
  // if we didn't allow '..' to escape the current working directory context
  const normalized = path.normalize(dirPath);
  if (normalized.includes('..')) {
    // Check if using '..' would actually escape the intended directory
    // For simplicity, we just ensure the resolved path is used
    const resolvedFromNormalized = path.resolve(normalized);
    if (resolvedFromNormalized !== resolved) {
      throw new Error("Invalid path: path traversal detected");
    }
  }
  return resolved;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, op: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${op} timed out after ${ms}ms`)), ms));
  return Promise.race([promise, timeout]);
}

async function withRetry<T>(fn: () => Promise<T>, attempts: number = MAX_RETRY_ATTEMPTS, op: string): Promise<T> {
  let lastError: Error | null = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastError = e;
      logger.warn(`${op} attempt ${i + 1} failed`, { error: e.message });
      if (i < attempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i))); // Exponential backoff
      }
    }
  }
  throw lastError || new Error(`${op} failed after ${attempts} attempts`);
}

function isBinaryFile(content: Buffer): boolean {
  // Check for null bytes which indicate binary content
  for (let i = 0; i < Math.min(content.length, 8000); i++) {
    if (content[i] === 0) return true;
  }
  return false;
}

async function getCacheSize(dirPath: string): Promise<number> {
  let totalSize = 0;
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        totalSize += await getCacheSize(fullPath);
      } else {
        const stat = await fs.stat(fullPath);
        totalSize += stat.size;
      }
    }
  } catch (e) {
    // ignore
  }
  return totalSize;
}

async function cleanupCache(baseDir: string, maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<string[]> {
  const cleaned: string[] = [];
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    const now = Date.now();
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const fullPath = path.join(baseDir, entry.name);
      try {
        const stat = await fs.stat(fullPath);
        if (now - stat.mtimeMs > maxAgeMs) {
          await fs.rm(fullPath, { recursive: true, force: true });
          cleaned.push(entry.name);
        }
      } catch (e) {
        // skip
      }
    }
  } catch (e) {
    // baseDir may not exist
  }
  return cleaned;
}

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

// Helper function to search within documentation files
async function searchDocsInDir(dirPath: string, searchPattern: string, filePattern?: string) {
  const release = await operationLimiter.acquire();
  try {
    const docs = await findDocsInDir(dirPath);
    const regex = new RegExp(searchPattern, 'gi');
    const results: Array<{ file: string; line: number; content: string }> = [];

    for (const file of docs) {
      if (filePattern && !new RegExp(filePattern).test(file)) continue;
      
      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            results.push({
              file,
              line: i + 1,
              content: lines[i].trim(),
            });
          }
        }
      } catch (e) {
        // Skip files that can't be read
      }
    }

    return results;
  } finally {
    release();
  }
}

// Helper function to find docs in a given directory
async function findDocsInDir(dirPath: string) {
  const readmeFiles = await glob("**/*readme*.md", {
    cwd: dirPath,
    nocase: true,
    ignore: ["**/node_modules/**"],
  });

  const docsFolderFiles = await glob("docs/**/*.md", {
    cwd: dirPath,
    nocase: true,
    ignore: ["**/node_modules/**"],
  });

  // Combine and deduplicate
  const allFiles = Array.from(new Set([...readmeFiles, ...docsFolderFiles]));
  return allFiles.map((file) => path.join(dirPath, file));
}

// Helper function to analyze project context from multi-language package managers
export async function analyzeProjectContext(dirPath: string) {
  const commonFiles = [
    // Node.js
    "package.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb",
    // PHP
    "composer.json", "composer.lock",
    // Go
    "go.mod", "go.sum",
    // Rust
    "Cargo.toml", "Cargo.lock",
    // Python
    "requirements.txt", "pyproject.toml", "Pipfile", "Pipfile.lock", "setup.py",
    // Ruby
    "Gemfile", "Gemfile.lock",
    // Java / Kotlin / Scala
    "pom.xml", "build.gradle", "build.gradle.kts", "settings.gradle",
    // C / C++
    "CMakeLists.txt", "Makefile", "conanfile.txt", "conanfile.py",
    // .NET / C#
    "*.csproj", "*.fsproj", "packages.config",
// Elixir / Erlang
"mix.exs", "mix.lock",
// Dart
"pubspec.yaml", "pubspec.lock"
  ];

  // Additional files
  const extraFiles = ["Package.swift", "shard.yml", "rebar.config"];

  const allPatterns = [...commonFiles, ...extraFiles];

  const foundFiles = await glob(allPatterns, {
    cwd: dirPath,
    nocase: true,
    ignore: ["**/node_modules/**", "**/vendor/**", "**/.git/**", "**/target/**", "**/dist/**", "**/build/**"],
  });

  const analysis: Record<string, string> = {};
  
  for (const file of foundFiles) {
    const fullPath = path.join(dirPath, file);
        try {
          const stat = await fs.stat(fullPath);
          if (stat.isFile() && stat.size < MAX_FILE_SIZE_TECH) {
            const content = await fs.readFile(fullPath, "utf-8");
            analysis[file] = content;
          } else {
            analysis[file] = `[File too large or not a file: ${stat.size} bytes]`;
          }
    } catch (e: any) {
      analysis[file] = `[Error reading file: ${e.message}]`;
    }
  }

  return analysis;
}

// Helper function to gather project conventions, linters, and architectural guidelines (Agnostic)
async function gatherProjectConventions(dirPath: string) {
  const conventionPatterns = [
    // Markdown rules (fuzzy)
    "**/*contribut*.{md,txt}", "**/*architectur*.{md,txt}", "**/*style*.{md,txt}", "**/*convention*.{md,txt}", "**/*standard*.{md,txt}", "**/*guideline*.{md,txt}",
    // Generic linter/formatter configs (fuzzy)
    "**/*lint*rc*", "**/*.lint*", "**/*format*rc*", "**/*.format*", "**/*-cs-fixer*", "**/*rules*.{json,yaml,yml,xml,toml}",
    // Editor config
    "**/.editorconfig",
    // Known specific linters just in case
    "**/.eslintrc*", "**/eslint.config.*", "**/.prettierrc*", "**/prettier.config.*", "**/biome.json",
    "**/phpcs.xml", "**/phpstan.neon", "**/golangci.y*ml", "**/tox.ini", "**/.flake8", "**/.rubocop.yml", "**/rustfmt.toml"
  ];

  const foundFiles = await glob(conventionPatterns, {
    cwd: dirPath,
    nocase: true,
    ignore: ["**/node_modules/**", "**/vendor/**", "**/.git/**", "**/target/**", "**/dist/**", "**/build/**", "**/.next/**", "**/.nuxt/**"],
  });

  const conventions: Record<string, string> = {};
  
  for (const file of foundFiles) {
    const fullPath = path.join(dirPath, file);
    try {
      const stat = await fs.stat(fullPath);
      if (stat.isFile() && stat.size < MAX_FILE_SIZE_CONVENTIONS) {
        const content = await fs.readFile(fullPath, "utf-8");
        conventions[file] = content;
      } else {
        conventions[file] = `[File too large to include context automatically: ${stat.size} bytes]`;
      }
    } catch (e: any) {
      conventions[file] = `[Error reading file: ${e.message}]`;
    }
  }

  return conventions;
}

// Helper function to extract code patterns (implicit conventions) from random source code files
async function sampleCodebasePatterns(dirPath: string) {
  // Grab a broad set of source files, ignoring configs, docs, and tests if possible.
  const sourcePatterns = [
    "src/**/*.{js,ts,jsx,tsx,php,go,rs,py,rb,java,cpp,c,cs,swift,dart,ex}",
    "app/**/*.{js,ts,jsx,tsx,php,go,rs,py,rb,java,cpp,c,cs,swift,dart,ex}",
    "lib/**/*.{js,ts,jsx,tsx,php,go,rs,py,rb,java,cpp,c,cs,swift,dart,ex}",
    "internal/**/*.{js,ts,jsx,tsx,php,go,rs,py,rb,java,cpp,c,cs,swift,dart,ex}",
    "pkg/**/*.{js,ts,jsx,tsx,php,go,rs,py,rb,java,cpp,c,cs,swift,dart,ex}",
  ];

  const foundFiles = await glob(sourcePatterns, {
    cwd: dirPath,
    nocase: true,
    ignore: ["**/node_modules/**", "**/vendor/**", "**/.git/**", "**/target/**", "**/dist/**", "**/build/**", "**/*.test.*", "**/*.spec.*", "**/test/**", "**/tests/**"],
  });

// Limit to at most 3 random files to avoid huge token usage, but enough to establish a pattern
const selectedFiles: string[] = [];
const shuffled = [...foundFiles];
for (let i = 0; i < 3 && shuffled.length > 0; i++) {
  const idx = Math.floor(Math.random() * shuffled.length);
  selectedFiles.push(shuffled[idx]);
  shuffled.splice(idx, 1);
}
  
  const patterns: Record<string, string> = {};
  
  for (const file of selectedFiles) {
    const fullPath = path.join(dirPath, file);
    try {
      const stat = await fs.stat(fullPath);
      if (stat.isFile() && stat.size < MAX_FILE_SIZE_SAMPLE) {
        const content = await fs.readFile(fullPath, "utf-8");
        patterns[file] = content;
      }
    } catch (e: any) {
      patterns[file] = `[Error reading file: ${e.message}]`;
    }
  }

  return patterns;
}

// Define the tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "init_workspace",
        description:
          "Initializes a .docsgrep workspace in the specified project directory to store temporary files, logs, and reports. Also automatically updates the .gitignore file.",
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
        name: "analyze_project_tech_stack",
        description:
          "Analyzes a local directory to identify the project's technology stack by reading package manager files (e.g., package.json, composer.json, go.mod, Cargo.toml).",
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
        name: "gather_project_conventions",
        description:
          "Gathers project conventions, linters, and architectural guidelines (e.g., .eslintrc, phpcs.xml, CONTRIBUTING.md, .editorconfig) to provide context for code quality audits.",
        inputSchema: {
          type: "object",
          properties: {
            dirPath: {
              type: "string",
              description: "The absolute path to the local directory to scan for conventions.",
            },
          },
          required: ["dirPath"],
        },
      },
      {
        name: "sample_codebase_patterns",
        description:
          "Samples a few representative source code files from a local directory. Use this when a project lacks explicit documentation or linter configs to infer implicit coding conventions and style directly from the code.",
        inputSchema: {
          type: "object",
          properties: {
            dirPath: {
              type: "string",
              description: "The absolute path to the local directory to sample.",
            },
          },
          required: ["dirPath"],
        },
      },
      {
        name: "explore_local_docs",
        description:
          "Explores a local directory to find README files and documentation inside docs/ folders.",
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
        name: "explore_remote_repo",
        description:
          "Clones a remote git repository to a temporary directory and finds README files and documentation.",
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
            }
          },
          required: ["repoUrl"],
        },
      },
        {
          name: "read_doc_file",
          description: "Reads the contents of a specific documentation or README file.",
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
          name: "cleanup_cache",
          description: "Cleans up old cached repositories in the .docsgrep workspace. Removes repos older than the specified max age (default 7 days).",
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
          name: "search_docs",
          description: "Searches for a pattern within documentation files (README, docs/**/*.md) in a local directory. Returns matching lines with file path and line number.",
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
          name: "audit_code_quality",
          description: "Performs an enterprise-grade code quality audit. Analyzes tech stack, conventions, and applies industry best practices to detect issues like dead code, god classes, SOC violations, and more.",
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
          name: "get_audit_prompt",
          description: "Generates an interactive prompt to ask the user what they want to audit. Helps guide the audit process by showing detected tech stack and available options.",
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
          name: "security_audit",
          description: "Performs an enterprise-grade security audit covering OWASP Top 10, ISO/IEC 27001, secrets detection, privacy (GDPR/CCPA), and dependency vulnerabilities. Provides comprehensive security analysis with remediation steps.",
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
          name: "get_security_audit_prompt",
          description: "Generates an interactive prompt for security auditing. Shows what will be scanned (OWASP Top 10, secrets, privacy, dependencies) and available options.",
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
      ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "init_workspace": {
      const { projectPath: rawPath } = request.params.arguments as { projectPath: string };

      try {
        const projectPath = validateDirPath(validateStringParam(rawPath, "projectPath"));
        const workspacePath = path.join(projectPath, ".docsgrep");
        await fs.mkdir(path.join(workspacePath, "tmp"), { recursive: true });
        await fs.mkdir(path.join(workspacePath, "repos"), { recursive: true });
        await fs.mkdir(path.join(workspacePath, "logs"), { recursive: true });
        await fs.mkdir(path.join(workspacePath, "reports"), { recursive: true });

        const gitignorePath = path.join(projectPath, ".gitignore");
        try {
          const gitignoreContent = await fs.readFile(gitignorePath, "utf-8");
          if (!gitignoreContent.includes(".docsgrep")) {
            await fs.appendFile(gitignorePath, "\n.docsgrep\n");
          }
        } catch (e: any) {
          if (e.code === "ENOENT") {
            await fs.writeFile(gitignorePath, ".docsgrep\n");
          }
        }

        const contextInfo = {
          initializedAt: new Date().toISOString(),
          projectPath: projectPath,
          version: pkg.version
        };
        await fs.writeFile(path.join(workspacePath, "context.json"), JSON.stringify(contextInfo, null, 2));

        return {
          content: [
            {
              type: "text",
              text: `Successfully initialized .docsgrep workspace at ${workspacePath}. The directory has been added to .gitignore.`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error initializing workspace: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "analyze_project_tech_stack": {
      const { dirPath: rawPath } = request.params.arguments as { dirPath: string };

      try {
        const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
        const stat = await fs.stat(dirPath);
        if (!stat.isDirectory()) {
          throw new Error("Provided path is not a directory");
        }

        const analysis = await analyzeProjectContext(dirPath);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: `Found ${Object.keys(analysis).length} package manager files in local directory.`,
                  files: analysis,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error analyzing tech stack: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "gather_project_conventions": {
      const { dirPath: rawPath } = request.params.arguments as { dirPath: string };

      try {
        const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
        const stat = await fs.stat(dirPath);
        if (!stat.isDirectory()) {
          throw new Error("Provided path is not a directory");
        }

        const conventions = await gatherProjectConventions(dirPath);
        
        let message = `Found ${Object.keys(conventions).length} convention/linter files in local directory.`;
        if (Object.keys(conventions).length === 0) {
          message += " No explicit documentation or linter config was found. Consider using the 'sample_codebase_patterns' tool to infer implicit conventions from the code.";
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message,
                  files: conventions,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error gathering conventions: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "sample_codebase_patterns": {
      const { dirPath: rawPath } = request.params.arguments as { dirPath: string };

      try {
        const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
        const stat = await fs.stat(dirPath);
        if (!stat.isDirectory()) {
          throw new Error("Provided path is not a directory");
        }

        const patterns = await sampleCodebasePatterns(dirPath);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: `Sampled ${Object.keys(patterns).length} source files to infer codebase patterns. Please analyze these files to determine the project's unwritten conventions (e.g. naming, spacing, paradigm).`,
                  files: patterns,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error sampling codebase patterns: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "explore_local_docs": {
      const { dirPath: rawPath } = request.params.arguments as { dirPath: string };

      try {
        const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
        const stat = await fs.stat(dirPath);
        if (!stat.isDirectory()) {
          throw new Error("Provided path is not a directory");
        }

        const files = await findDocsInDir(dirPath);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: `Found ${files.length} documentation files in local directory.`,
                  files,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error exploring local directory: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

case "explore_remote_repo": {
  const { repoUrl, branch, localProjectPath } = request.params.arguments as { repoUrl: string, branch?: string, localProjectPath?: string };

    try {
      // Validate repoUrl
      const validatedUrl = validateStringParam(repoUrl, "repoUrl");
      try {
        new URL(validatedUrl);
      } catch (e) {
        throw new Error("Invalid repoUrl: not a valid URL");
      }
      if (!/^(https?|git|ssh):\/\//.test(validatedUrl)) {
        throw new Error("Invalid repoUrl: must use http, https, git, or ssh protocol");
      }

      let baseReposDir = path.join(os.tmpdir(), "docsgrep-repos");
      
      if (localProjectPath) {
        const validatedLocalPath = validateDirPath(localProjectPath);
        baseReposDir = path.join(validatedLocalPath, ".docsgrep", "repos");
      }
        await fs.mkdir(baseReposDir, { recursive: true });

        const hashInput = branch ? `${repoUrl}#${branch}` : repoUrl;
        const repoHash = crypto.createHash("md5").update(hashInput).digest("hex").substring(0, 8);
        const repoName = repoUrl.split("/").pop()?.replace(".git", "") || "repo";
        const branchSuffix = branch ? `-${branch.replace(/[^a-zA-Z0-9]/g, "_")}` : "";
        const targetDir = path.join(baseReposDir, `${repoName}${branchSuffix}-${repoHash}`);
        
        let message = "";
        
        try {
          // Try to pull existing repo first with retry
          logger.info(`Attempting to pull latest changes`, { url: validatedUrl, branch: branch || "default", target: targetDir });
          const git: SimpleGit = simpleGit(targetDir);
          
          const fetchArgs = ["--depth", "1"];
          if (branch) {
            await withRetry(() => withTimeout(git.fetch("origin", branch, fetchArgs), GIT_TIMEOUT_MS, "git fetch"), MAX_RETRY_ATTEMPTS, "git fetch");
          } else {
            await withRetry(() => withTimeout(git.fetch(fetchArgs), GIT_TIMEOUT_MS, "git fetch"), MAX_RETRY_ATTEMPTS, "git fetch");
          }

          await withRetry(() => withTimeout(git.reset(["--hard", "FETCH_HEAD"]), GIT_TIMEOUT_MS, "git reset"), MAX_RETRY_ATTEMPTS, "git reset");
          await withRetry(() => withTimeout(git.clean("f", ["-d"]), GIT_TIMEOUT_MS, "git clean"), MAX_RETRY_ATTEMPTS, "git clean");
          message = `Successfully updated and explored repository. Found {count} files.`;
        } catch (e) {
          // Repo doesn't exist, clone it with retry
          logger.info(`Cloning repository`, { url: validatedUrl, branch: branch || "default", target: targetDir });
          const git: SimpleGit = simpleGit();
          
          const cloneArgs = ["--depth", "1"];
          if (branch) {
            cloneArgs.push("--branch", branch);
          }
          
          await withRetry(() => withTimeout(git.clone(validatedUrl, targetDir, cloneArgs), GIT_TIMEOUT_MS, "git clone"), MAX_RETRY_ATTEMPTS, "git clone");
          message = `Successfully cloned and explored repository. Found {count} files.`;
        }

        const files = await findDocsInDir(targetDir);
        message = message.replace("{count}", files.length.toString());
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message,
                  tempDirectory: targetDir,
                  files,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error cloning or exploring remote repo: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "read_doc_file": {
      const { filePath } = request.params.arguments as { filePath: string };

      try {
        if (!filePath || typeof filePath !== "string") {
          throw new Error("Invalid file path: must be a non-empty string");
        }
        const resolvedPath = path.resolve(filePath);
        
        const stat = await fs.stat(resolvedPath);
        if (!stat.isFile()) {
          throw new Error("Path is not a file");
        }
        
        if (stat.size > MAX_FILE_SIZE_READ) {
          throw new Error(`File too large: ${stat.size} bytes (max ${MAX_FILE_SIZE_READ})`);
        }
        
        // Check if binary
        const buffer = await fs.readFile(resolvedPath);
        if (isBinaryFile(buffer)) {
          throw new Error("Cannot read binary file");
        }
        
        const content = buffer.toString("utf-8");
        return {
          content: [
            {
              type: "text",
              text: content,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error reading file ${filePath}: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "cleanup_cache": {
      const { localProjectPath: rawPath, maxAgeDays } = request.params.arguments as { localProjectPath: string; maxAgeDays?: number };

      try {
        const localProjectPath = validateDirPath(validateStringParam(rawPath, "localProjectPath"));
        const reposDir = path.join(localProjectPath, ".docsgrep", "repos");
        const maxAgeMs = (maxAgeDays && maxAgeDays > 0 ? maxAgeDays : 7) * 24 * 60 * 60 * 1000;
        const cleaned = await cleanupCache(reposDir, maxAgeMs);
        
        // Also check cache size
        const cacheSize = await getCacheSize(reposDir);
        const cacheSizeMB = cacheSize / (1024 * 1024);
        
        let message = `Cleaned up ${cleaned.length} cached repositories.`;
        if (cacheSizeMB > MAX_CACHE_SIZE_MB) {
          message += ` Warning: Cache size (${cacheSizeMB.toFixed(2)}MB) exceeds limit (${MAX_CACHE_SIZE_MB}MB).`;
        } else {
          message += ` Current cache size: ${cacheSizeMB.toFixed(2)}MB.`;
        }
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message,
                  cleanedRepos: cleaned,
                  cacheSizeMB: parseFloat(cacheSizeMB.toFixed(2)),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error cleaning cache: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "search_docs": {
      const { dirPath: rawPath, pattern, filePattern } = request.params.arguments as {
        dirPath: string;
        pattern: string;
        filePattern?: string;
      };

      try {
        const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
        const validatedPattern = validateStringParam(pattern, "pattern");
        
        // Validate regex
        try {
          new RegExp(validatedPattern);
        } catch (e: any) {
          throw new Error(`Invalid regex pattern: ${e.message}`);
        }

        const results = await searchDocsInDir(dirPath, validatedPattern, filePattern);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: `Found ${results.length} matches for pattern "${validatedPattern}".`,
                  results,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error searching docs: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "audit_code_quality": {
      const { dirPath: rawPath, filePatterns, focusAreas } = request.params.arguments as {
        dirPath: string;
        filePatterns?: string[];
        focusAreas?: string[];
      };

      try {
        const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
        
        const release = await operationLimiter.acquire();
        try {
          logger.info("Starting universal code quality audit", { dirPath, filePatterns, focusAreas });
          
          // Use the new universal audit function
          const { performUniversalAudit } = await import('./best-practices.js');
          const report: AuditReport = await performUniversalAudit(dirPath, filePatterns);
          
          logger.info("Audit completed", { 
            filesScanned: report.summary.filesScanned,
            totalIssues: report.summary.totalIssues 
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
                    issues: report.issues || [], // Limited to 100 in performAudit
                    strengths: report.strengths || [],
                    recommendations: report.recommendations || [],
                    note: report.issues && report.issues.length >= 100 ? "Results limited to 100 issues. There may be more issues." : undefined,
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

    case "get_audit_prompt": {
      const { dirPath: rawPath } = request.params.arguments as { dirPath: string };

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

    case "security_audit": {
      const { dirPath: rawPath, filePatterns } = request.params.arguments as {
        dirPath: string;
        filePatterns?: string[];
      };

      try {
        const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
        
        const release = await operationLimiter.acquire();
        try {
          logger.info("Starting security audit", { dirPath, filePatterns });
          
          const report: SecurityAuditReport = await performSecurityAudit(dirPath, filePatterns);
          
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
                    note: report.secretsFound.length >= 50 ? "Secrets list limited to 50 items." : undefined,
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

    case "get_security_audit_prompt": {
      const { dirPath: rawPath } = request.params.arguments as { dirPath: string };

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

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
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
